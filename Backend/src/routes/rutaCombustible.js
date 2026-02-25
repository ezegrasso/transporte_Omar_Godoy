import express from 'express';
import { body, param, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import CombustibleMovimiento from '../models/CombustibleMovimiento.js';
import CombustibleStock from '../models/CombustibleStock.js';
import Camion from '../models/Camion.js';
import Usuario from '../models/Usuario.js';

const router = express.Router();

const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const parseMesAnio = (query) => {
    const now = new Date();
    return {
        mes: Number(query?.mes) || (now.getMonth() + 1),
        anio: Number(query?.anio) || now.getFullYear()
    };
};

const getOrCreateStock = async () => {
    let stock = await CombustibleStock.findOne({ order: [['id', 'ASC']] });
    if (!stock) stock = await CombustibleStock.create({ disponibleLitros: 0 });
    return stock;
};

router.get('/stock', authMiddleware, async (_req, res) => {
    try {
        const stock = await getOrCreateStock();
        res.json({
            disponibleLitros: toNum(stock.disponibleLitros),
            updatedAt: stock.updatedAt
        });
    } catch (e) {
        console.error('[combustible] Error obteniendo stock:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo stock de combustible' });
    }
});

router.get('/mis-cargas', authMiddleware, async (req, res) => {
    try {
        const { mes, anio } = parseMesAnio(req.query);
        const cargas = await CombustibleMovimiento.findAll({
            where: {
                camioneroId: req.user.id,
                mes,
                anio,
                tipoRegistro: 'carga'
            },
            include: [{ model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo'] }],
            order: [['fechaCarga', 'DESC'], ['createdAt', 'DESC']]
        });

        const totalLitros = cargas.reduce((sum, item) => sum + toNum(item.litros), 0);

        res.json({ cargas, totalLitros, mes, anio });
    } catch (e) {
        console.error('[combustible] Error obteniendo mis cargas:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo cargas de combustible' });
    }
});

router.post('/cargas',
    authMiddleware,
    [
        body('fechaCarga').isISO8601().withMessage('Fecha inválida'),
        body('litros').isFloat({ min: 0.01 }).withMessage('Litros inválidos'),
        body('precioUnitario').isFloat({ min: 0.01 }).withMessage('Precio unitario inválido'),
        body('camionId').isInt({ min: 1 }).withMessage('Camión inválido'),
        body('origen').isIn(['predio', 'externo']).withMessage('Origen inválido'),
        body('observaciones').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { fechaCarga, litros, precioUnitario, camionId, origen, observaciones } = req.body;

            const camion = await Camion.findByPk(camionId);
            if (!camion) return res.status(404).json({ error: 'Camión no encontrado' });

            const fecha = String(fechaCarga).slice(0, 10);
            const [anio, mes] = fecha.split('-').map(Number);
            const litrosNum = Number(Number(litros).toFixed(2));
            const precioUnitarioNum = Number(Number(precioUnitario).toFixed(2));
            const importeTotalNum = Number((litrosNum * precioUnitarioNum).toFixed(2));
            const observacionesLimpias = String(observaciones || '').trim();
            const lugarFinal = origen === 'predio' ? 'Carga predio' : 'Carga externa';

            const stock = await getOrCreateStock();
            const stockActual = toNum(stock.disponibleLitros);

            if (origen === 'predio' && stockActual < litrosNum) {
                return res.status(400).json({ error: `Stock insuficiente en predio. Disponible: ${stockActual.toFixed(2)} L` });
            }

            const carga = await CombustibleMovimiento.create({
                camionId,
                camioneroId: req.user.id,
                fechaCarga: fecha,
                mes,
                anio,
                litros: litrosNum,
                precioUnitario: precioUnitarioNum,
                importeTotal: importeTotalNum,
                lugar: lugarFinal,
                origen,
                tipoRegistro: 'carga',
                observaciones: observacionesLimpias || null
            });

            if (origen === 'predio') {
                const nuevoStock = Number((stockActual - litrosNum).toFixed(2));
                stock.disponibleLitros = nuevoStock;
                stock.updatedById = req.user.id;
                await stock.save();
            }

            res.status(201).json({
                success: true,
                carga,
                stockPredio: toNum(stock.disponibleLitros)
            });
        } catch (e) {
            console.error('[combustible] Error registrando carga:', e?.message || e);
            res.status(500).json({ error: 'Error registrando carga de combustible' });
        }
    }
);

router.post('/predio/ajuste',
    authMiddleware,
    [
        body('litros').isFloat({ min: 0.01 }).withMessage('Litros inválidos'),
        body('tipo').isIn(['ingreso', 'egreso']).withMessage('Tipo inválido'),
        body('observaciones').optional().isString()
    ],
    async (req, res) => {
        try {
            if (!['ceo', 'administracion'].includes(req.user?.rol)) {
                return res.status(403).json({ error: 'No tienes permisos para ajustar stock' });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { litros, tipo, observaciones } = req.body;
            const litrosNum = Number(Number(litros).toFixed(2));

            const stock = await getOrCreateStock();
            const stockActual = toNum(stock.disponibleLitros);
            const delta = tipo === 'ingreso' ? litrosNum : -litrosNum;
            const nuevoStock = Number((stockActual + delta).toFixed(2));

            if (nuevoStock < 0) {
                return res.status(400).json({ error: `El ajuste deja stock negativo. Disponible actual: ${stockActual.toFixed(2)} L` });
            }

            const now = new Date();
            const fecha = now.toISOString().slice(0, 10);

            await CombustibleMovimiento.create({
                camionId: null,
                camioneroId: req.user.id,
                fechaCarga: fecha,
                mes: now.getMonth() + 1,
                anio: now.getFullYear(),
                litros: litrosNum,
                lugar: 'Predio Omar Godoy',
                origen: 'ajuste',
                tipoRegistro: 'ajuste',
                observaciones: observaciones || `Ajuste manual (${tipo})`
            });

            stock.disponibleLitros = nuevoStock;
            stock.updatedById = req.user.id;
            await stock.save();

            res.json({ success: true, disponibleLitros: nuevoStock });
        } catch (e) {
            console.error('[combustible] Error ajustando stock:', e?.message || e);
            res.status(500).json({ error: 'Error ajustando stock de combustible' });
        }
    }
);

router.get('/resumen', authMiddleware, async (req, res) => {
    try {
        if (!['ceo', 'administracion'].includes(req.user?.rol)) {
            return res.status(403).json({ error: 'No tienes permisos para ver este resumen' });
        }

        const { mes, anio } = parseMesAnio(req.query);

        const cargas = await CombustibleMovimiento.findAll({
            where: {
                mes,
                anio,
                tipoRegistro: 'carga',
                origen: { [Op.in]: ['predio', 'externo'] }
            },
            include: [
                { model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo'] },
                { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
            ],
            order: [['fechaCarga', 'DESC'], ['createdAt', 'DESC']]
        });

        const porCamion = new Map();
        let totalLitros = 0;
        let totalPredio = 0;
        let totalExterno = 0;

        for (const item of cargas) {
            const litros = toNum(item.litros);
            totalLitros += litros;
            if (item.origen === 'predio') totalPredio += litros;
            if (item.origen === 'externo') totalExterno += litros;

            const key = item.camionId || 0;
            if (!porCamion.has(key)) {
                porCamion.set(key, {
                    camionId: item.camionId,
                    camion: item.camion,
                    totalLitros: 0,
                    totalPredio: 0,
                    totalExterno: 0,
                    cargas: []
                });
            }
            const row = porCamion.get(key);
            row.totalLitros += litros;
            if (item.origen === 'predio') row.totalPredio += litros;
            if (item.origen === 'externo') row.totalExterno += litros;
            row.cargas.push(item);
        }

        const detallePorCamion = Array.from(porCamion.values())
            .map((row) => ({
                ...row,
                totalLitros: Number(row.totalLitros.toFixed(2)),
                totalPredio: Number(row.totalPredio.toFixed(2)),
                totalExterno: Number(row.totalExterno.toFixed(2)),
                cantidadCargas: row.cargas.length
            }))
            .sort((a, b) => b.totalLitros - a.totalLitros);

        const stock = await getOrCreateStock();

        res.json({
            mes,
            anio,
            stockPredio: toNum(stock.disponibleLitros),
            totalLitros: Number(totalLitros.toFixed(2)),
            totalPredio: Number(totalPredio.toFixed(2)),
            totalExterno: Number(totalExterno.toFixed(2)),
            detallePorCamion
        });
    } catch (e) {
        console.error('[combustible] Error obteniendo resumen:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo resumen de combustible' });
    }
});

router.get('/camion/:camionId/detalle',
    authMiddleware,
    [param('camionId').isInt({ min: 1 })],
    async (req, res) => {
        try {
            if (!['ceo', 'administracion'].includes(req.user?.rol)) {
                return res.status(403).json({ error: 'No tienes permisos para ver este detalle' });
            }

            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { mes, anio } = parseMesAnio(req.query);
            const camionId = Number(req.params.camionId);

            const cargas = await CombustibleMovimiento.findAll({
                where: {
                    camionId,
                    mes,
                    anio,
                    tipoRegistro: 'carga',
                    origen: { [Op.in]: ['predio', 'externo'] }
                },
                include: [
                    { model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo'] },
                    { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
                ],
                order: [['fechaCarga', 'DESC'], ['createdAt', 'DESC']]
            });

            const totalLitros = cargas.reduce((sum, item) => sum + toNum(item.litros), 0);
            const totalImporte = cargas.reduce((sum, item) => sum + toNum(item.importeTotal || (toNum(item.litros) * toNum(item.precioUnitario))), 0);

            res.json({
                camion: cargas[0]?.camion || null,
                mes,
                anio,
                totalLitros: Number(totalLitros.toFixed(2)),
                totalImporte: Number(totalImporte.toFixed(2)),
                cargas
            });
        } catch (e) {
            console.error('[combustible] Error obteniendo detalle por camión:', e?.message || e);
            res.status(500).json({ error: 'Error obteniendo detalle de combustible por camión' });
        }
    }
);

export default router;

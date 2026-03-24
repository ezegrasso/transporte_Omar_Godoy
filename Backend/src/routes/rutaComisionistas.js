import { Router } from 'express';
import { Op } from 'sequelize';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import Comisionista from '../models/Comisionista.js';
import Viaje from '../models/Viajes.js';
import Usuario from '../models/Usuario.js';

const router = Router();

const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

const getMesRange = (mes, anio) => {
    const month = Number(mes);
    const year = Number(anio);
    if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000) {
        return null;
    }
    const from = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { from, to, month, year };
};

router.get('/', authMiddleware, async (_req, res) => {
    try {
        const rows = await Comisionista.findAll({ order: [['nombre', 'ASC']] });
        res.json({ data: rows || [] });
    } catch (e) {
        console.error('[comisionistas] GET error:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo comisionistas' });
    }
});

router.post('/', authMiddleware, async (req, res) => {
    try {
        const nombre = String(req.body?.nombre || '').trim();
        const porcentaje = toNum(req.body?.porcentaje);

        if (!nombre) return res.status(400).json({ error: 'El nombre del comisionista es requerido' });
        if (porcentaje < 0 || porcentaje > 100) return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100' });

        const dup = await Comisionista.findOne({ where: { nombre } });
        if (dup) return res.status(400).json({ error: 'Ese comisionista ya existe' });

        const row = await Comisionista.create({ nombre, porcentaje: Number(porcentaje.toFixed(2)) });
        res.status(201).json(row);
    } catch (e) {
        console.error('[comisionistas] POST error:', e?.message || e);
        res.status(500).json({ error: 'Error creando comisionista' });
    }
});

router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const row = await Comisionista.findByPk(id);
        if (!row) return res.status(404).json({ error: 'Comisionista no encontrado' });

        const nombre = req.body?.nombre !== undefined ? String(req.body.nombre || '').trim() : row.nombre;
        const porcentaje = req.body?.porcentaje !== undefined ? toNum(req.body.porcentaje) : toNum(row.porcentaje);

        if (!nombre) return res.status(400).json({ error: 'El nombre del comisionista es requerido' });
        if (porcentaje < 0 || porcentaje > 100) return res.status(400).json({ error: 'El porcentaje debe estar entre 0 y 100' });

        const dup = await Comisionista.findOne({ where: { nombre, id: { [Op.ne]: id } } });
        if (dup) return res.status(400).json({ error: 'Ya existe otro comisionista con ese nombre' });

        row.nombre = nombre;
        row.porcentaje = Number(porcentaje.toFixed(2));
        await row.save();

        // Mantener consistencia visual y de cálculo en paneles:
        // al editar el porcentaje base, actualizar también el snapshot en viajes ya asignados.
        await Viaje.update(
            { comisionPorcentaje: row.porcentaje },
            { where: { comisionistaId: id } }
        );

        res.json(row);
    } catch (e) {
        console.error('[comisionistas] PUT error:', e?.message || e);
        res.status(500).json({ error: 'Error actualizando comisionista' });
    }
});

router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const row = await Comisionista.findByPk(id);
        if (!row) return res.status(404).json({ error: 'Comisionista no encontrado' });

        await Viaje.update({ comisionistaId: null, comisionPorcentaje: null }, { where: { comisionistaId: id } });
        await row.destroy();

        res.json({ success: true });
    } catch (e) {
        console.error('[comisionistas] DELETE error:', e?.message || e);
        res.status(500).json({ error: 'Error eliminando comisionista' });
    }
});

router.get('/resumen', authMiddleware, async (req, res) => {
    try {
        const now = new Date();
        const mes = Number(req.query?.mes) || (now.getMonth() + 1);
        const anio = Number(req.query?.anio) || now.getFullYear();
        const range = getMesRange(mes, anio);
        if (!range) return res.status(400).json({ error: 'Mes/año inválidos' });

        const viajes = await Viaje.findAll({
            where: {
                comisionistaId: { [Op.ne]: null },
                fecha: { [Op.between]: [range.from, range.to] }
            },
            include: [
                { model: Comisionista, as: 'comisionista', attributes: ['id', 'nombre', 'porcentaje'] },
                { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
            ],
            order: [['fecha', 'DESC']]
        });

        const map = new Map();
        let totalComisiones = 0;

        for (const v of viajes) {
            const comId = v.comisionistaId;
            if (!comId) continue;
            const importe = toNum(v.importe);
            const porcentaje = toNum(v.comisionPorcentaje ?? v.comisionista?.porcentaje);
            const comision = Number((importe * (porcentaje / 100)).toFixed(2));

            totalComisiones += comision;

            if (!map.has(comId)) {
                map.set(comId, {
                    comisionistaId: comId,
                    nombre: v.comisionista?.nombre || `Comisionista #${comId}`,
                    porcentajeDefault: toNum(v.comisionista?.porcentaje),
                    totalViajes: 0,
                    totalImporte: 0,
                    totalComision: 0,
                    viajes: []
                });
            }

            const row = map.get(comId);
            row.totalViajes += 1;
            row.totalImporte += importe;
            row.totalComision += comision;
            row.viajes.push({
                id: v.id,
                fecha: v.fecha,
                origen: v.origen,
                destino: v.destino,
                camionero: v.camionero || null,
                camioneroNombre: v.camioneroNombre || null,
                importe,
                porcentaje,
                comision,
                facturaNumero: v.facturaNumero || null,
                estado: v.estado
            });
        }

        const data = Array.from(map.values()).map((r) => ({
            ...r,
            totalImporte: Number(r.totalImporte.toFixed(2)),
            totalComision: Number(r.totalComision.toFixed(2))
        })).sort((a, b) => b.totalComision - a.totalComision);

        res.json({
            mes: range.month,
            anio: range.year,
            totalComisiones: Number(totalComisiones.toFixed(2)),
            data
        });
    } catch (e) {
        console.error('[comisionistas] RESUMEN error:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo resumen de comisionistas' });
    }
});

router.get('/:id/viajes', authMiddleware, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const row = await Comisionista.findByPk(id);
        if (!row) return res.status(404).json({ error: 'Comisionista no encontrado' });

        const now = new Date();
        const mes = Number(req.query?.mes) || (now.getMonth() + 1);
        const anio = Number(req.query?.anio) || now.getFullYear();
        const range = getMesRange(mes, anio);
        if (!range) return res.status(400).json({ error: 'Mes/año inválidos' });

        const viajes = await Viaje.findAll({
            where: {
                comisionistaId: id,
                fecha: { [Op.between]: [range.from, range.to] }
            },
            include: [{ model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }],
            order: [['fecha', 'DESC']]
        });

        const list = (viajes || []).map((v) => {
            const importe = toNum(v.importe);
            const porcentaje = toNum(v.comisionPorcentaje ?? row.porcentaje);
            const comision = Number((importe * (porcentaje / 100)).toFixed(2));
            return {
                id: v.id,
                fecha: v.fecha,
                origen: v.origen,
                destino: v.destino,
                camionero: v.camionero || null,
                camioneroNombre: v.camioneroNombre || null,
                importe,
                porcentaje,
                comision,
                facturaNumero: v.facturaNumero || null,
                estado: v.estado
            };
        });

        const totalComision = list.reduce((sum, v) => sum + toNum(v.comision), 0);
        const totalImporte = list.reduce((sum, v) => sum + toNum(v.importe), 0);

        res.json({
            comisionista: row,
            mes: range.month,
            anio: range.year,
            totalViajes: list.length,
            totalImporte: Number(totalImporte.toFixed(2)),
            totalComision: Number(totalComision.toFixed(2)),
            data: list
        });
    } catch (e) {
        console.error('[comisionistas] VIAJES error:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo viajes del comisionista' });
    }
});

export default router;

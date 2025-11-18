
import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { body, param, query, validationResult } from 'express-validator';
import sequelize from '../config/db.js';
import { Op } from 'sequelize';
import Viaje from '../models/Viajes.js';
import Usuario from '../models/Usuario.js';
import Camion from '../models/Camion.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import Notificacion from '../models/Notificacion.js';

const router = Router();

// Configuración de subida de archivos
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const id = req.params.id || 'general';
        const dir = path.resolve('uploads', 'viajes', String(id));
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const ext = path.extname(file.originalname);
        const base = file.fieldname === 'file' ? 'factura' : 'remito';
        cb(null, `${base}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage });

// Obtener viajes (ceo/administracion ven todos; camionero ve disponibles/asignados)
router.get('/', authMiddleware, [
    query('estado').optional().isString(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('sortBy').optional().isIn(['id', 'fecha', 'estado']),
    query('order').optional().isIn(['ASC', 'DESC'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const page = parseInt(req.query.page || '1', 10);
        const limit = parseInt(req.query.limit || '10', 10);
        const offset = (page - 1) * limit;
        const sortBy = req.query.sortBy || 'id';
        const order = (req.query.order || 'ASC').toUpperCase();
        const estado = req.query.estado;
        const where = {};
        if (estado) where.estado = estado;
        // Restricción por rol
        if (req.user.rol !== 'ceo' && req.user.rol !== 'administracion') {
            if (estado === 'pendiente') {
                where.estado = 'pendiente';
            } else {
                where.camioneroId = req.user.id;
            }
        }
        // Filtro por fechas
        if (req.query.from || req.query.to) {
            where.fecha = {};
            if (req.query.from) where.fecha[Op.gte] = new Date(req.query.from);
            if (req.query.to) {
                // Incluir todo el día final añadiendo 23:59:59 para evitar excluir viajes del último día
                const endDate = new Date(req.query.to);
                endDate.setHours(23, 59, 59, 999);
                where.fecha[Op.lte] = endDate;
            }
        }
        const { rows, count } = await Viaje.findAndCountAll({
            where,
            limit,
            offset,
            order: [[sortBy, order]],
            include: [
                { model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo', 'anio'] },
                { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
            ]
        });
        res.json({ data: rows, page, limit, total: count });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener viajes' });
    }
});

// Crear viaje (solo ceo)
router.post('/',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        body('origen').isString().notEmpty(),
        body('destino').isString().notEmpty(),
        body('fecha').isISO8601(),
        body('camionId').isInt(),
        body('tipoMercaderia').optional().isString().isLength({ min: 2, max: 120 }),
        body('cliente').optional().isString().isLength({ min: 2, max: 120 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const payload = { ...req.body, estado: 'pendiente' };
            const nuevoViaje = await Viaje.create(payload);
            res.status(201).json(nuevoViaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear viaje' });
        }
    });

// Tomar viaje (camionero lo asigna y cambia estado a "en curso")
router.patch('/:id/tomar',
    authMiddleware,
    roleMiddleware(['camionero']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            await sequelize.transaction(async (t) => {
                const viaje = await Viaje.findByPk(req.params.id, { transaction: t, lock: t.LOCK.UPDATE });
                if (!viaje || viaje.estado !== 'pendiente') throw { status: 400, message: 'Viaje no disponible' };
                viaje.estado = 'en curso';
                viaje.camioneroId = req.user.id;
                // Guardar datos históricos del camionero para informes
                viaje.camioneroNombre = req.user.nombre;
                viaje.camioneroEmail = req.user.email;
                await viaje.save({ transaction: t });
                res.json(viaje);
            });
        } catch (error) {
            res.status(500).json({ error: 'Error al tomar viaje' });
        }
    });

// Finalizar viaje (camionero actualiza km, combustible y estado)
router.patch('/:id/finalizar',
    authMiddleware,
    roleMiddleware(['camionero']),
    [param('id').isInt(), body('km').isInt({ min: 0 }), body('combustible').isFloat({ min: 0 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje || viaje.estado !== 'en curso' || viaje.camioneroId !== req.user.id) return res.status(400).json({ error: 'No autorizado o viaje no válido' });
            viaje.estado = 'finalizado';
            viaje.km = req.body.km;
            viaje.combustible = req.body.combustible;
            // Si por alguna razón no quedó seteado al tomar, persistimos los datos del camionero aquí
            if (!viaje.camioneroNombre) viaje.camioneroNombre = req.user?.nombre;
            if (!viaje.camioneroEmail) viaje.camioneroEmail = req.user?.email;
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al finalizar viaje' });
        }
    });

// Cancelar viaje tomado (camionero devuelve a pendiente)
router.patch('/:id/cancelar',
    authMiddleware,
    roleMiddleware(['camionero']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje || viaje.estado !== 'en curso' || viaje.camioneroId !== req.user.id) return res.status(400).json({ error: 'No autorizado o viaje no válido' });
            viaje.estado = 'pendiente';
            viaje.camioneroId = null;
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al cancelar viaje' });
        }
    });

// Reporte de viajes (solo ceo)
router.get('/reporte', authMiddleware, roleMiddleware(['ceo']), async (req, res) => {
    try {
        const viajes = await Viaje.findAll();
        res.json(viajes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reporte' });
    }
});

// Subir factura (ceo/administracion)
router.post('/:id/factura',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt()],
    upload.single('file'),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            let url = viaje.facturaUrl;
            if (req.file) {
                const rel = `/uploads/viajes/${req.params.id}/${req.file.filename}`;
                url = rel;
            }
            viaje.facturaUrl = url;
            if (req.body.fechaFactura) viaje.fechaFactura = new Date(req.body.fechaFactura);
            if (req.body.facturaEstado) viaje.facturaEstado = req.body.facturaEstado;
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al subir factura' });
        }
    }
);

// Subir remitos (múltiples)
router.post('/:id/remitos',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt()],
    upload.array('files', 10),
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            const existing = viaje.remitosJson ? JSON.parse(viaje.remitosJson) : [];
            const added = (req.files || []).map(f => `/uploads/viajes/${req.params.id}/${f.filename}`);
            viaje.remitosJson = JSON.stringify([...existing, ...added]);
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al subir remitos' });
        }
    }
);

// Actualizar estado/fecha de factura
router.patch('/:id/factura',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt(), body('facturaEstado').optional().isString(), body('fechaFactura').optional().isISO8601()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            if (req.body.facturaEstado) viaje.facturaEstado = req.body.facturaEstado;
            if (req.body.fechaFactura) viaje.fechaFactura = new Date(req.body.fechaFactura);
            await viaje.save();
            res.json(viaje);
        } catch (e) {
            res.status(500).json({ error: 'Error al actualizar factura' });
        }
    }
);

// Chequear facturas vencidas (>30 días sin cobrar) y notificar (ceo/administracion)
router.post('/checkVencidas', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res) => {
    try {
        const all = await Viaje.findAll();
        const now = Date.now();
        let created = 0;
        let actualizadas = 0;
        for (const v of all) {
            const fechaBase = v.fechaFactura || v.fecha;
            const estado = (v.facturaEstado || 'pendiente').toLowerCase();
            if (fechaBase && estado !== 'cobrada') {
                const days = Math.floor((now - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24));
                if (days > 30) {
                    if (estado !== 'vencida') { v.facturaEstado = 'vencida'; actualizadas++; }
                    if (!v.facturaNotificadaVencida) {
                        await Notificacion.create({
                            tipo: 'factura_vencida',
                            mensaje: `Factura vencida del viaje #${v.id} (${v.cliente || 'Cliente desconocido'})`,
                        });
                        v.facturaNotificadaVencida = true;
                        created++;
                    }
                    await v.save();
                }
            }
        }
        res.json({ notificacionesCreadas: created, facturasMarcadasVencidas: actualizadas });
    } catch (e) {
        res.status(500).json({ error: 'Error al chequear vencidas' });
    }
});

// Backfill de nombres de camionero en viajes históricos (ceo/administracion)
router.post('/backfillCamioneros', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res) => {
    try {
        const afectados = [];
        const viajes = await Viaje.findAll({ where: { camioneroId: { [Op.ne]: null } } });
        for (const v of viajes) {
            if (!v.camioneroNombre || !v.camioneroEmail) {
                const u = await Usuario.findByPk(v.camioneroId);
                if (u) {
                    v.camioneroNombre = v.camioneroNombre || u.nombre;
                    v.camioneroEmail = v.camioneroEmail || u.email;
                    await v.save();
                    afectados.push(v.id);
                }
            }
        }
        res.json({ actualizados: afectados.length, ids: afectados });
    } catch (e) {
        res.status(500).json({ error: 'Error al completar nombres de camionero' });
    }
});
// Detalle de viaje (solo ceo)
router.get('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id, {
                include: [
                    { model: Camion, as: 'camion', attributes: ['id', 'patente', 'marca', 'modelo', 'anio'] },
                    { model: Usuario, as: 'camionero', attributes: ['id', 'nombre', 'email'] }
                ]
            });
            if (!viaje) return res.status(404).json({ error: 'Viaje no encontrado' });
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener detalle' });
        }
    });

// Liberar viaje (ceo fuerza que un viaje en curso vuelva a pendiente)
router.patch('/:id/liberar',
    authMiddleware,
    roleMiddleware(['ceo']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const viaje = await Viaje.findByPk(req.params.id);
            if (!viaje || viaje.estado !== 'en curso') return res.status(400).json({ error: 'Viaje no está en curso' });
            viaje.estado = 'pendiente';
            viaje.camioneroId = null;
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al liberar viaje' });
        }
    });

export default router;

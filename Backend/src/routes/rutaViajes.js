
import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import sequelize from '../config/db.js';
import Viaje from '../models/Viajes.js';
import Usuario from '../models/Usuario.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Obtener viajes (admin ve todos, camionero solo los disponibles o asignados)
router.get('/', authMiddleware, [
    query('estado').optional().isString(),
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
        if (req.user.rol !== 'admin') {
            if (estado === 'pendiente') {
                where.estado = 'pendiente';
            } else {
                where.camioneroId = req.user.id;
            }
        }
        const { rows, count } = await Viaje.findAndCountAll({ where, limit, offset, order: [[sortBy, order]] });
        res.json({ data: rows, page, limit, total: count });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener viajes' });
    }
});

// Crear viaje (solo admin)
router.post('/',
    authMiddleware,
    roleMiddleware(['admin']),
    [
        body('origen').isString().notEmpty(),
        body('destino').isString().notEmpty(),
        body('fecha').isISO8601(),
        body('camionId').isInt()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const nuevoViaje = await Viaje.create({ ...req.body, estado: 'pendiente' });
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
            await viaje.save();
            res.json(viaje);
        } catch (error) {
            res.status(500).json({ error: 'Error al finalizar viaje' });
        }
    });

// Reporte de viajes (solo admin)
router.get('/reporte', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const viajes = await Viaje.findAll();
        res.json(viajes);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener reporte' });
    }
});

export default router;

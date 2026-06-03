import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { Op } from 'sequelize';
import Vencimiento from '../models/Vencimiento.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

const DEFAULT_ITEMS_BY_TYPE = {
    camion: ['tecnica', 'seguro', 'senasa'],
    acoplado: ['tecnica', 'seguro', 'senasa'],
    camionero: ['carnet', 'curso_profesional', 'psicofisico'],
};

const ensureDefaultItems = async (tipoObjeto, objetoId) => {
    const defaults = DEFAULT_ITEMS_BY_TYPE[tipoObjeto] || [];
    let rows = await Vencimiento.findAll({ where: { tipoObjeto, objetoId }, order: [['item', 'ASC']] });
    const existingItems = new Set(rows.map(r => r.item));
    const missing = defaults.filter(item => !existingItems.has(item));

    if (missing.length > 0) {
        await Vencimiento.bulkCreate(missing.map(item => ({ tipoObjeto, objetoId, item })));
        rows = await Vencimiento.findAll({ where: { tipoObjeto, objetoId }, order: [['item', 'ASC']] });
    }

    return rows;
};

// Listar vencimientos por objeto (camion o acoplado)
router.get('/',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [query('tipo').isIn(['camion', 'acoplado', 'camionero']), query('id').isInt({ min: 1 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const tipo = req.query.tipo;
            const objetoId = Number(req.query.id);
            const rows = await ensureDefaultItems(tipo, objetoId);
            res.json(rows);
        } catch (e) {
            res.status(500).json({ error: 'Error al listar vencimientos' });
        }
    }
);

// Listar vencimientos propios del camionero/mantenimiento
router.get('/mios',
    authMiddleware,
    roleMiddleware(['camionero', 'mantenimiento']),
    async (req, res) => {
        try {
            const rows = await ensureDefaultItems('camionero', req.user.id);
            res.json(rows);
        } catch (e) {
            res.status(500).json({ error: 'Error al listar vencimientos' });
        }
    }
);

// Crear/actualizar/borrrar
router.post('/',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [
        body('tipoObjeto').isIn(['camion', 'acoplado', 'camionero']),
        body('objetoId').isInt({ min: 1 }),
        body('item').isIn(['tecnica', 'seguro', 'senasa', 'carnet', 'curso_profesional', 'psicofisico']),
        body('fechaDesde').optional({ nullable: true }).isISO8601(),
        body('fechaHasta').optional({ nullable: true }).isISO8601(),
        body('observaciones').optional().isString().trim()
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const created = await Vencimiento.create({
                tipoObjeto: req.body.tipoObjeto,
                objetoId: Number(req.body.objetoId),
                item: req.body.item,
                fechaDesde: req.body.fechaDesde || null,
                fechaHasta: req.body.fechaHasta || null,
                observaciones: req.body.observaciones || null,
                creadoPor: req.user?.id || null
            });
            res.status(201).json(created);
        } catch (e) {
            res.status(500).json({ error: 'Error creando vencimiento' });
        }
    }
);

router.put('/mios/:id',
    authMiddleware,
    roleMiddleware(['camionero', 'mantenimiento']),
    [param('id').isInt({ min: 1 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const id = Number(req.params.id);
            const row = await Vencimiento.findOne({ where: { id, tipoObjeto: 'camionero', objetoId: req.user.id } });
            if (!row) return res.status(404).json({ error: 'No encontrado' });
            const nextValues = {};
            if (Object.prototype.hasOwnProperty.call(req.body, 'fechaDesde')) nextValues.fechaDesde = req.body.fechaDesde;
            if (Object.prototype.hasOwnProperty.call(req.body, 'fechaHasta')) nextValues.fechaHasta = req.body.fechaHasta;
            if (Object.prototype.hasOwnProperty.call(req.body, 'observaciones')) nextValues.observaciones = req.body.observaciones;
            await row.update(nextValues);
            res.json(row);
        } catch (e) {
            res.status(500).json({ error: 'Error actualizando vencimiento' });
        }
    }
);

router.put('/:id',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt({ min: 1 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const id = Number(req.params.id);
            const updated = await Vencimiento.update(req.body, { where: { id } });
            if (!updated) return res.status(404).json({ error: 'No encontrado' });
            const item = await Vencimiento.findByPk(id);
            res.json(item);
        } catch (e) {
            res.status(500).json({ error: 'Error actualizando vencimiento' });
        }
    }
);

router.delete('/:id',
    authMiddleware,
    roleMiddleware(['ceo', 'administracion']),
    [param('id').isInt({ min: 1 })],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const id = Number(req.params.id);
            const deleted = await Vencimiento.destroy({ where: { id } });
            if (!deleted) return res.status(404).json({ error: 'No encontrado' });
            res.json({ ok: true });
        } catch (e) {
            res.status(500).json({ error: 'Error eliminando vencimiento' });
        }
    }
);

// Endpoint para chequear vencimientos pendientes (interno/admin)
router.get('/pendientes/list', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res) => {
    try {
        const today = new Date();
        const iso = today.toISOString().slice(0, 10);
        const rows = await Vencimiento.findAll({ where: { fechaHasta: { [Op.lte]: iso }, notificado: false } });
        res.json(rows);
    } catch (e) {
        res.status(500).json({ error: 'Error listando vencimientos pendientes' });
    }
});

export default router;

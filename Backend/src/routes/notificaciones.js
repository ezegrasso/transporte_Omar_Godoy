import { Router } from 'express';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
import Notificacion from '../models/Notificacion.js';
import { param, validationResult } from 'express-validator';

const router = Router();

// Listar notificaciones (solo ceo)
router.get('/', authMiddleware, roleMiddleware(['ceo']), async (req, res) => {
    try {
        const list = await Notificacion.findAll({ order: [['fecha', 'DESC']] });
        res.json(list);
    } catch (e) {
        res.status(500).json({ error: 'Error al obtener notificaciones' });
    }
});

// Marcar como leída
router.patch('/:id/leida', authMiddleware, roleMiddleware(['ceo']), [param('id').isInt()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const n = await Notificacion.findByPk(req.params.id);
        if (!n) return res.status(404).json({ error: 'No encontrada' });
        n.leida = true;
        await n.save();
        res.json(n);
    } catch (e) {
        res.status(500).json({ error: 'Error al actualizar' });
    }
});

// Eliminar todas las notificaciones leídas (solo ceo)
router.delete('/leidas/all', authMiddleware, roleMiddleware(['ceo']), async (req, res) => {
    try {
        const count = await Notificacion.destroy({ where: { leida: true } });
        res.json({ eliminadas: count });
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar leídas' });
    }
});

// Eliminar todas las notificaciones (solo ceo)
router.delete('/', authMiddleware, roleMiddleware(['ceo']), async (req, res) => {
    try {
        const count = await Notificacion.destroy({ where: {} });
        res.json({ eliminadas: count });
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar todas' });
    }
});

// Eliminar notificación por id (solo ceo) - definir al final para no captar rutas específicas
router.delete('/:id', authMiddleware, roleMiddleware(['ceo']), [param('id').isInt()], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
        const deleted = await Notificacion.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ error: 'No encontrada' });
        res.status(204).send();
    } catch (e) {
        res.status(500).json({ error: 'Error al eliminar' });
    }
});

export default router;

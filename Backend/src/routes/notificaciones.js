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

export default router;

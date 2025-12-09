import { Router } from 'express';
import { getAll, getById, create, update, remove } from '../models/Acoplado.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';
const router = Router();

// Listar todos
router.get('/', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res, next) => {
    try {
        const data = await getAll();
        res.json(Array.isArray(data) ? data : { data });
    } catch (err) { next(err); }
});

// Obtener uno
router.get('/:id', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res, next) => {
    try {
        const item = await getById(req.params.id);
        if (!item) return res.status(404).json({ error: 'No encontrado' });
        res.json(item);
    } catch (err) { next(err); }
});

// Crear (CEO/Admin)
router.post('/', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res, next) => {
    try {
        const patente = String(req.body.patente || '').toUpperCase().replace(/\s+/g, '').trim();
        await create({ patente });
        res.status(201).json({ ok: true });
    } catch (err) { next(err); }
});

// Editar (CEO/Admin)
router.patch('/:id', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res, next) => {
    try {
        const patente = String(req.body.patente || '').toUpperCase().replace(/\s+/g, '').trim();
        await update(req.params.id, { patente });
        res.json({ ok: true });
    } catch (err) { next(err); }
});

// Borrar (CEO/Admin)
router.delete('/:id', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res, next) => {
    try {
        await remove(req.params.id);
        res.json({ ok: true });
    } catch (err) { next(err); }
});
export default router;

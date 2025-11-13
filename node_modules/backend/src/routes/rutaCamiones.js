

import { Router } from 'express';
import { body, param, validationResult, query } from 'express-validator';
import Camion from '../models/Camion.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Obtener camiones con paginación/orden (usuario autenticado)
router.get('/',
    authMiddleware,
    [
        query('page').optional().isInt({ min: 1 }),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('sortBy').optional().isIn(['id', 'patente', 'marca', 'modelo', 'anio']),
        query('order').optional().isIn(['ASC', 'DESC'])
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const page = parseInt(req.query.page || '1', 10);
            const limit = parseInt(req.query.limit || '10', 10);
            const offset = (page - 1) * limit;
            const sortBy = req.query.sortBy || 'id';
            const order = (req.query.order || 'ASC').toUpperCase();
            const { rows, count } = await Camion.findAndCountAll({ limit, offset, order: [[sortBy, order]] });
            res.json({ data: rows, page, limit, total: count });
        } catch (error) {
            res.status(500).json({ error: 'Error al obtener camiones' });
        }
    });

// Crear un camión (solo admin)
router.post('/',
    authMiddleware,
    roleMiddleware(['admin']),
    [
        body('patente').isString().notEmpty(),
        body('marca').isString().notEmpty(),
        body('modelo').isString().notEmpty(),
        body('anio').isInt({ min: 1900 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const nuevoCamion = await Camion.create(req.body);
            res.status(201).json(nuevoCamion);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear camión' });
        }
    });

// Actualizar un camión (solo admin)
router.put('/:id',
    authMiddleware,
    roleMiddleware(['admin']),
    [
        param('id').isInt(),
        body('anio').optional().isInt({ min: 1900 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { id } = req.params;
            const [updated] = await Camion.update(req.body, { where: { id } });
            if (updated) {
                const camionActualizado = await Camion.findByPk(id);
                res.json(camionActualizado);
            } else {
                res.status(404).json({ error: 'Camión no encontrado' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error al actualizar camión' });
        }
    });

// Eliminar un camión (solo admin)
router.delete('/:id',
    authMiddleware,
    roleMiddleware(['admin']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { id } = req.params;
            const deleted = await Camion.destroy({ where: { id } });
            if (deleted) {
                res.json({ mensaje: 'Camión eliminado' });
            } else {
                res.status(404).json({ error: 'Camión no encontrado' });
            }
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar camión' });
        }
    });

export default router;

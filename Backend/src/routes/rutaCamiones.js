

import { Router } from 'express';
import { body, param, validationResult, query } from 'express-validator';
import Camion from '../models/Camion.js';
import Usuario from '../models/Usuario.js';
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

// Crear un camión (solo ceo)
router.post('/',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        body('patente')
            .isString().notEmpty()
            .customSanitizer(v => String(v).toUpperCase().trim())
            .matches(/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/)
            .withMessage('Patente inválida (formato permitido: AAA123 o AB123CD)'),
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
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'La patente ya está en uso' });
            }
            res.status(500).json({ error: 'Error al crear camión' });
        }
    });

// Actualizar un camión (solo ceo)
router.put('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        param('id').isInt(),
        body('anio').optional().isInt({ min: 1900 }),
        body('patente')
            .optional()
            .isString().notEmpty()
            .customSanitizer(v => String(v).toUpperCase().trim())
            .matches(/^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/)
            .withMessage('Patente inválida (formato permitido: AAA123 o AB123CD)')
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
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'La patente ya está en uso' });
            }
            res.status(500).json({ error: 'Error al actualizar camión' });
        }
    });

// Eliminar un camión (solo ceo)
router.delete('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
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

// Asignar/un asignar camionero a un camión (solo ceo)
router.post('/:id/asignarCamionero',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        param('id').isInt(),
        body('camioneroId').optional({ nullable: true }).isInt().withMessage('camioneroId debe ser entero')
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { id } = req.params;
        const { camioneroId } = req.body;
        try {
            const camion = await Camion.findByPk(id);
            if (!camion) return res.status(404).json({ error: 'Camión no encontrado' });

            // Permitir desasignar si viene null/undefined
            if (camioneroId === null || camioneroId === undefined) {
                camion.camioneroId = null;
                await camion.save();
                return res.json({ mensaje: 'Camionero desasignado', camion });
            }

            // Validar que el usuario exista y sea camionero
            const usuario = await Usuario.scope('withPassword').findByPk(camioneroId);
            if (!usuario || usuario.rol !== 'camionero') {
                return res.status(400).json({ error: 'camioneroId inválido o usuario no es camionero' });
            }

            camion.camioneroId = camioneroId;
            await camion.save();
            res.json({ mensaje: 'Camionero asignado', camion });
        } catch (error) {
            res.status(500).json({ error: 'Error al asignar camionero' });
        }
    }
);

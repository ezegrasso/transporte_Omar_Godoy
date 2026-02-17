import express from 'express';
import Estadia from '../models/Estadia.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// GET estadías del camionero actual (mes/año específico o actual)
router.get('/mis-estadias', authMiddleware, async (req, res) => {
    try {
        const { mes, anio } = req.query;
        const hoy = new Date();
        const mesActual = parseInt(mes) || hoy.getMonth() + 1;
        const anioActual = parseInt(anio) || hoy.getFullYear();

        const estadias = await Estadia.findAll({
            where: {
                camioneroId: req.user.id,
                mes: mesActual,
                anio: anioActual
            },
            order: [['fechaInicio', 'ASC']]
        });

        const totalEstadia = estadias.reduce((sum, e) => sum + parseFloat(e.monto || 0), 0);

        res.json({ estadias, totalEstadia, mes: mesActual, anio: anioActual });
    } catch (e) {
        console.error('[estadias] Error getting mis-estadias:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo estadías' });
    }
});

// POST crear estadía (camionero registra sus gastos de estadía)
router.post('/',
    authMiddleware,
    [
        body('fechaInicio').isISO8601(),
        body('fechaFin').isISO8601(),
        body('monto').isFloat({ min: 0 }),
        body('descripcion').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const { fechaInicio, fechaFin, monto, descripcion } = req.body;

            // Validar que fechaFin >= fechaInicio
            if (fechaFin < fechaInicio) {
                return res.status(400).json({ error: 'La fecha de fin debe ser mayor o igual a la de inicio' });
            }

            // Extraer mes/año de fechaInicio
            const [anio, mes] = fechaInicio.split('-').slice(0, 2).map(Number);

            // Crear estadía
            const estadia = await Estadia.create({
                camioneroId: req.user.id,
                fechaInicio,
                fechaFin,
                monto: parseFloat(monto),
                mes,
                anio,
                descripcion: descripcion || null
            });

            res.status(201).json({ success: true, estadia });
        } catch (e) {
            console.error('[estadias] Error creating estadia:', e?.message || e);
            res.status(500).json({ error: 'Error creando estadía' });
        }
    });

// DELETE estadía (camionero elimina su estadía)
router.delete('/:id',
    authMiddleware,
    [param('id').isInt()],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

            const estadia = await Estadia.findByPk(req.params.id);
            if (!estadia) {
                return res.status(404).json({ error: 'Estadía no encontrada' });
            }

            // Verificar que sea del camionero
            if (estadia.camioneroId !== req.user.id && !['ceo', 'administracion'].includes(req.user.rol)) {
                return res.status(403).json({ error: 'No autorizado' });
            }

            await estadia.destroy();
            res.json({ success: true });
        } catch (e) {
            console.error('[estadias] Error deleting estadia:', e?.message || e);
            res.status(500).json({ error: 'Error eliminando estadía' });
        }
    });

// GET estadías de un camionero (CEO/Administración)
router.get('/camionero/:camioneroId', authMiddleware, async (req, res) => {
    try {
        if (!['ceo', 'administracion'].includes(req.user?.rol)) {
            return res.status(403).json({ error: 'No tienes permiso' });
        }

        const { mes, anio } = req.query;
        const hoy = new Date();
        const mesActual = parseInt(mes) || hoy.getMonth() + 1;
        const anioActual = parseInt(anio) || hoy.getFullYear();

        const estadias = await Estadia.findAll({
            where: {
                camioneroId: req.params.camioneroId,
                mes: mesActual,
                anio: anioActual
            },
            order: [['fechaInicio', 'ASC']]
        });

        const totalEstadia = estadias.reduce((sum, e) => sum + parseFloat(e.monto || 0), 0);

        res.json({ estadias, totalEstadia, mes: mesActual, anio: anioActual });
    } catch (e) {
        console.error('[estadias] Error getting estadias:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo estadías' });
    }
});

export default router;

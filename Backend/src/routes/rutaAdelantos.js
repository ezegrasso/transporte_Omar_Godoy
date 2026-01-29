import express from 'express';
import Adelanto from '../models/Adelanto.js';
import Usuario from '../models/Usuario.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';
import { sendEmail } from '../services/emailService.js';

const router = express.Router();

// GET adelantos del camionero actual (mes/año específico o actual)
router.get('/mis-adelantos', authMiddleware, async (req, res) => {
    try {
        const { mes, anio } = req.query;
        const hoy = new Date();
        const mesActual = parseInt(mes) || hoy.getMonth() + 1;
        const anioActual = parseInt(anio) || hoy.getFullYear();

        const adelantos = await Adelanto.findAll({
            where: {
                camioneroId: req.user.id,
                mes: mesActual,
                anio: anioActual
            },
            order: [['createdAt', 'DESC']]
        });

        const totalAdelanto = adelantos.reduce((sum, a) => sum + parseFloat(a.monto || 0), 0);

        res.json({ adelantos, totalAdelanto, mes: mesActual, anio: anioActual });
    } catch (e) {
        console.error('[adelantos] Error getting mis-adelantos:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo adelantos' });
    }
});

// POST crear adelanto (CEO/Administración)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { camioneroId, monto, mes, anio, descripcion } = req.body;

        // Validar permisos (solo CEO o administración)
        if (!['ceo', 'administracion'].includes(req.user?.rol)) {
            return res.status(403).json({ error: 'No tienes permiso para crear adelantos' });
        }

        // Validar datos
        if (!camioneroId || !monto || !mes || !anio) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        // Verificar que el usuario sea camionero
        const camionero = await Usuario.findByPk(camioneroId);
        if (!camionero || camionero.rol !== 'camionero') {
            return res.status(400).json({ error: 'Usuario no es camionero' });
        }

        // Crear adelanto
        const adelanto = await Adelanto.create({
            camioneroId,
            monto: parseFloat(monto),
            mes: parseInt(mes),
            anio: parseInt(anio),
            descripcion,
            creadoPor: req.user.id
        });

        // Enviar email al camionero
        try {
            const mesNombre = new Date(anio, mes - 1, 1).toLocaleString('es-AR', { month: 'long', year: 'numeric' });
            const subject = `Adelanto registrado - ${mesNombre}`;
            const text = `Hola ${camionero.nombre},

Se ha registrado un adelanto de $${monto} para el mes de ${mesNombre}.

${descripcion ? `Descripción: ${descripcion}\n` : ''}
Podés ver el detalle en tu panel de "Mis Viajes".

Saludos,
Sistema de Transporte Omar Godoy`;

            await sendEmail({
                to: camionero.email,
                subject,
                text
            });
        } catch (emailError) {
            console.error('[adelantos] Error sending email:', emailError?.message);
            // No fallar la operación si el email falla
        }

        res.status(201).json({ success: true, adelanto });
    } catch (e) {
        console.error('[adelantos] Error creating adelanto:', e?.message || e);
        res.status(500).json({ error: 'Error creando adelanto' });
    }
});

// GET todos los adelantos de un camionero (para CEO)
router.get('/camionero/:camioneroId', authMiddleware, async (req, res) => {
    try {
        if (!['ceo', 'administracion'].includes(req.user?.rol)) {
            return res.status(403).json({ error: 'No tienes permiso' });
        }

        const { camioneroId } = req.params;
        const adelantos = await Adelanto.findAll({
            where: { camioneroId },
            order: [['anio', 'DESC'], ['mes', 'DESC']]
        });

        res.json(adelantos);
    } catch (e) {
        console.error('[adelantos] Error getting camionero adelantos:', e?.message || e);
        res.status(500).json({ error: 'Error obteniendo adelantos' });
    }
});

// PATCH actualizar adelanto (CEO/Administración)
router.patch('/:id', authMiddleware, async (req, res) => {
    try {
        if (!['ceo', 'administracion'].includes(req.user?.rol)) {
            return res.status(403).json({ error: 'No tienes permiso para editar adelantos' });
        }

        const { id } = req.params;
        const { monto, descripcion } = req.body;

        const adelanto = await Adelanto.findByPk(id);
        if (!adelanto) {
            return res.status(404).json({ error: 'Adelanto no encontrado' });
        }

        // Actualizar
        if (monto !== undefined) adelanto.monto = parseFloat(monto);
        if (descripcion !== undefined) adelanto.descripcion = descripcion;

        await adelanto.save();

        res.json({ success: true, adelanto });
    } catch (e) {
        console.error('[adelantos] Error updating adelanto:', e?.message || e);
        res.status(500).json({ error: 'Error actualizando adelanto' });
    }
});

// DELETE eliminar adelanto (CEO/Administración)
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        if (!['ceo', 'administracion'].includes(req.user?.rol)) {
            return res.status(403).json({ error: 'No tienes permiso para eliminar adelantos' });
        }

        const { id } = req.params;
        const adelanto = await Adelanto.findByPk(id);

        if (!adelanto) {
            return res.status(404).json({ error: 'Adelanto no encontrado' });
        }

        await adelanto.destroy();
        res.json({ success: true, message: 'Adelanto eliminado' });
    } catch (e) {
        console.error('[adelantos] Error deleting adelanto:', e?.message || e);
        res.status(500).json({ error: 'Error eliminando adelanto' });
    }
});

export default router;

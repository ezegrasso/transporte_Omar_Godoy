import { Router } from 'express';
import Cliente from '../models/Cliente.js';
import { authMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// GET: Obtener todos los clientes
router.get('/', authMiddleware, async (req, res) => {
    try {
        const clientes = await Cliente.findAll({
            order: [['nombre', 'ASC']]
        });
        res.json({ data: clientes || [] });
    } catch (e) {
        console.error('[rutaClientes] GET error:', e.message);
        res.status(500).json({ error: 'Error al obtener clientes' });
    }
});

// POST: Crear nuevo cliente
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { nombre, cuit } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({ error: 'Nombre del cliente es requerido' });
        }

        // Verificar si ya existe
        const existente = await Cliente.findOne({
            where: { nombre: nombre.trim() }
        });

        if (existente) {
            return res.status(400).json({ error: 'El cliente ya existe' });
        }

        const cliente = await Cliente.create({
            nombre: nombre.trim(),
            cuit: cuit ? cuit.trim() : null
        });

        res.status(201).json(cliente);
    } catch (e) {
        console.error('[rutaClientes] POST error:', e.message);
        res.status(500).json({ error: 'Error al crear cliente' });
    }
});

// PUT: Actualizar cliente
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { nombre, cuit } = req.body;
        const cliente = await Cliente.findByPk(req.params.id);

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        if (nombre) cliente.nombre = nombre.trim();
        if (cuit !== undefined) cliente.cuit = cuit ? cuit.trim() : null;

        await cliente.save();
        res.json(cliente);
    } catch (e) {
        console.error('[rutaClientes] PUT error:', e.message);
        res.status(500).json({ error: 'Error al actualizar cliente' });
    }
});

// DELETE: Eliminar cliente
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const cliente = await Cliente.findByPk(req.params.id);

        if (!cliente) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }

        await cliente.destroy();
        res.json({ message: 'Cliente eliminado' });
    } catch (e) {
        console.error('[rutaClientes] DELETE error:', e.message);
        res.status(500).json({ error: 'Error al eliminar cliente' });
    }
});

export default router;

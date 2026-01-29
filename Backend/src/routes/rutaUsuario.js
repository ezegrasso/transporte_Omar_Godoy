
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import Usuario from '../models/Usuario.js';
// (Eliminado soporte WhatsApp)
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Crear usuario (solo admin)
router.post('/',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        body('nombre').isString().notEmpty(),
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('rol').isIn(['ceo', 'camionero', 'administracion']),
        body('avatarUrl').optional().isString().isLength({ min: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            // Impedir múltiples usuarios CEO
            if (req.body.rol === 'ceo') {
                const ceoCount = await Usuario.count({ where: { rol: 'ceo' } });
                if (ceoCount > 0) {
                    return res.status(400).json({ error: 'Ya existe un usuario con rol CEO. No se permite crear otro.' });
                }
            }
            const nuevoUsuario = await Usuario.create(req.body);
            res.status(201).json(nuevoUsuario);
        } catch (error) {
            res.status(500).json({ error: 'Error al crear usuario' });
        }
    });

// Ver perfil propio
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const usuario = await Usuario.findByPk(req.user.id);
        res.json(usuario);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
});

// Actualizar perfil propio
router.put('/me',
    authMiddleware,
    [
        body('nombre').optional().isString().notEmpty(),
        body('email').optional().isEmail(),
        body('password').optional().isLength({ min: 6 }),
        body('avatarUrl').optional().isString().isLength({ min: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const usuario = await Usuario.scope('withPassword').findByPk(req.user.id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            const updatable = ['nombre', 'email', 'password', 'avatarUrl'];
            updatable.forEach((k) => { if (req.body[k] !== undefined) usuario[k] = req.body[k]; });
            await usuario.save();
            const sanitizado = await Usuario.findByPk(req.user.id);
            res.json(sanitizado);
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }
            res.status(500).json({ error: 'Error al actualizar perfil' });
        }
    }
);

// Ver todos los usuarios (solo admin)
router.get('/', authMiddleware, roleMiddleware(['ceo', 'administracion']), async (req, res) => {
    try {
        const { rol } = req.query;
        const where = rol ? { rol } : {};
        const usuarios = await Usuario.findAll({ where });
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Actualizar usuario (solo admin)
router.put('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [
        param('id').isInt(),
        body('nombre').optional().isString().notEmpty(),
        body('email').optional().isEmail(),
        body('password').optional().isLength({ min: 6 }),
        body('rol').optional().isIn(['ceo', 'camionero', 'administracion']),
        body('avatarUrl').optional().isString().isLength({ min: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { id } = req.params;
            const usuario = await Usuario.scope('withPassword').findByPk(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

            // Impedir cambiar el rol del CEO (se puede editar nombre/email/password/avatar)
            if (usuario.rol === 'ceo' && req.body.rol && req.body.rol !== 'ceo') {
                return res.status(400).json({ error: 'El rol del CEO no puede modificarse' });
            }

            // Si se intenta convertir a este usuario en CEO y ya existe uno, impedirlo
            if (req.body.rol === 'ceo' && usuario.rol !== 'ceo') {
                const ceoCount = await Usuario.count({ where: { rol: 'ceo' } });
                if (ceoCount > 0) {
                    return res.status(400).json({ error: 'Ya existe un usuario con rol CEO. No se permite asignar otro.' });
                }
            }

            const updatable = ['nombre', 'email', 'password', 'rol', 'avatarUrl'];
            updatable.forEach((k) => {
                if (req.body[k] !== undefined) usuario[k] = req.body[k];
            });
            await usuario.save();
            const sanitizado = await Usuario.findByPk(id); // sin password por defaultScope
            res.json(sanitizado);
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }
            res.status(500).json({ error: 'Error al actualizar usuario' });
        }
    }
);

// Eliminar usuario (solo admin)
router.delete('/:id',
    authMiddleware,
    roleMiddleware(['ceo']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { id } = req.params;
            const usuario = await Usuario.findByPk(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            if (usuario.rol === 'ceo') {
                // Permitir borrar CEO solo si hay más de uno registrado
                const ceoCount = await Usuario.count({ where: { rol: 'ceo' } });
                if (ceoCount <= 1) {
                    return res.status(400).json({ error: 'No se puede eliminar el único usuario CEO del sistema' });
                }
            }
            await Usuario.destroy({ where: { id } });
            return res.json({ mensaje: 'Usuario eliminado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    }
);

export default router;

// Probar envío de WhatsApp a un usuario (solo CEO)

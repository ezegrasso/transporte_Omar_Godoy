
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import Usuario from '../models/Usuario.js';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware.js';

const router = Router();

// Crear usuario (solo admin)
router.post('/',
    authMiddleware,
    roleMiddleware(['admin']),
    [
        body('nombre').isString().notEmpty(),
        body('email').isEmail(),
        body('password').isLength({ min: 6 }),
        body('rol').isIn(['admin', 'camionero', 'administracion']),
        body('avatarUrl').optional().isString().isLength({ min: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
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
router.get('/', authMiddleware, roleMiddleware(['admin']), async (req, res) => {
    try {
        const usuarios = await Usuario.findAll();
        res.json(usuarios);
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
});

// Actualizar usuario (solo admin)
router.put('/:id',
    authMiddleware,
    roleMiddleware(['admin']),
    [
        param('id').isInt(),
        body('nombre').optional().isString().notEmpty(),
        body('email').optional().isEmail(),
        body('password').optional().isLength({ min: 6 }),
        body('rol').optional().isIn(['admin', 'camionero', 'administracion']),
        body('avatarUrl').optional().isString().isLength({ min: 5 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { id } = req.params;
            const usuario = await Usuario.scope('withPassword').findByPk(id);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

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
    roleMiddleware(['admin']),
    [param('id').isInt()],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        try {
            const { id } = req.params;
            const deleted = await Usuario.destroy({ where: { id } });
            if (deleted) return res.json({ mensaje: 'Usuario eliminado' });
            return res.status(404).json({ error: 'Usuario no encontrado' });
        } catch (error) {
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    }
);

export default router;

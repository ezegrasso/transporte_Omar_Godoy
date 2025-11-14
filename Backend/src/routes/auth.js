import { Router } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Usuario from '../models/Usuario.js';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

const router = Router();

// Rate limiting para login
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });

// Login
router.post('/login',
    loginLimiter,
    [
        body('email').isEmail(),
        body('password').isString().isLength({ min: 6 })
    ],
    async (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
        const { email, password } = req.body;
        try {
            const usuario = await Usuario.scope('withPassword').findOne({ where: { email } });
            if (!usuario) return res.status(401).json({ error: 'Credenciales inválidas' });
            const valid = await bcrypt.compare(password, usuario.password);
            if (!valid) return res.status(401).json({ error: 'Credenciales inválidas' });
            const expires = process.env.JWT_EXPIRES || '8h';
            const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: expires });
            res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
        } catch (error) {
            res.status(500).json({ error: 'Error en login' });
        }
    });

// Refresh: devuelve info del usuario actual (token debe ser válido)
router.get('/refresh', async (req, res, next) => {
    // Importar on-demand para evitar ciclos
    const { authMiddleware } = await import('../middlewares/authMiddleware.js');
    return authMiddleware(req, res, async () => {
        try {
            const usuario = await Usuario.findByPk(req.user.id, { attributes: ['id', 'nombre', 'rol'] });
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json({ usuario });
        } catch (error) {
            res.status(500).json({ error: 'Error en refresh' });
        }
    });
});

export default router;

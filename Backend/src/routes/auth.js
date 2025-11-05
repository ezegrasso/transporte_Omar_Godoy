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
            const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, process.env.JWT_SECRET, { expiresIn: '8h' });
            res.json({ token, usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol } });
        } catch (error) {
            res.status(500).json({ error: 'Error en login' });
        }
    });

export default router;

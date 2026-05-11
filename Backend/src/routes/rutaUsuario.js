
import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import Usuario from '../models/Usuario.js';
import sequelize from '../config/db.js';
import Viaje from '../models/Viajes.js';
import Camion from '../models/Camion.js';
import Adelanto from '../models/Adelanto.js';
import Estadia from '../models/Estadia.js';
import CombustibleMovimiento from '../models/CombustibleMovimiento.js';
import GastoFijo from '../models/GastoFijo.js';
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
        body('rol').isIn(['ceo', 'camionero', 'administracion', 'mantenimiento']),
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
            const sanitizado = await Usuario.findByPk(nuevoUsuario.id);
            res.status(201).json(sanitizado);
        } catch (error) {
            const dbMsg = String(error?.original?.message || error?.message || '');
            console.error('[usuarios] Error creando usuario:', error?.name, dbMsg);

            if (error?.name === 'SequelizeUniqueConstraintError' || error?.original?.code === 'ER_DUP_ENTRY') {
                return res.status(400).json({ error: 'El email ya está en uso' });
            }

            if (error?.name === 'SequelizeValidationError') {
                const msg = error?.errors?.[0]?.message || 'Datos inválidos para crear usuario';
                return res.status(400).json({ error: msg });
            }

            if (/Data truncated for column 'rol'|Incorrect .* value .* for column 'rol'/i.test(dbMsg)) {
                return res.status(400).json({
                    error: 'Rol inválido en base de datos. Actualizá el esquema para incluir mantenimiento.'
                });
            }

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
        const incluirInactivos = ['1', 'true', 'si', 'sí', 'yes'].includes(String(req.query?.incluirInactivos || '').toLowerCase());
        const where = rol ? { rol } : {};
        if (!incluirInactivos) where.activo = true;
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
        body('rol').optional().isIn(['ceo', 'camionero', 'administracion', 'mantenimiento']),
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
            const idNum = Number(id);
            const usuario = await Usuario.findByPk(idNum);
            if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
            if (usuario.rol === 'ceo') {
                // Permitir borrar CEO solo si hay más de uno registrado
                const ceoCount = await Usuario.count({ where: { rol: 'ceo' } });
                if (ceoCount <= 1) {
                    return res.status(400).json({ error: 'No se puede eliminar el único usuario CEO del sistema' });
                }
            }

            // Verificar dependencias que suelen impedir el borrado por FK.
            // - Viajes y camiones pueden desasociarse (SET NULL) preservando historia.
            // - Adelantos/estadías/combustible son registros económicos: si existen, bloquear borrado.
            const [viajesCount, camionesCount, adelantosCount, estadiasCount, combustibleCount] = await Promise.all([
                Viaje.count({ where: { camioneroId: idNum } }),
                Camion.count({ where: { camioneroId: idNum } }),
                Adelanto.count({ where: { camioneroId: idNum } }),
                Estadia.count({ where: { camioneroId: idNum } }),
                CombustibleMovimiento.count({ where: { camioneroId: idNum } })
            ]);

            const blockers = [];
            if (['camionero', 'mantenimiento'].includes(usuario.rol)) {
                if (adelantosCount > 0) blockers.push(`${adelantosCount} adelanto(s)`);
                if (estadiasCount > 0) blockers.push(`${estadiasCount} estadía(s)`);
                if (combustibleCount > 0) blockers.push(`${combustibleCount} carga(s) de combustible`);
            }

            if (blockers.length > 0) {
                await sequelize.transaction(async (t) => {
                    // Desasociar camiones asignados para que no vuelva a aparecer como opción de asignación.
                    if (camionesCount > 0) {
                        await Camion.update(
                            { camioneroId: null },
                            { where: { camioneroId: idNum }, transaction: t }
                        );
                    }
                    // Desactivar el usuario para preservar historial (FKs) pero impedir login/uso.
                    await Usuario.update(
                        { activo: false },
                        { where: { id: idNum }, transaction: t }
                    );
                });
                return res.json({
                    mensaje: `Usuario desactivado (tiene datos asociados: ${blockers.join(', ')}).`
                });
            }

            await sequelize.transaction(async (t) => {
                // Desasociar recursos asignados.
                if (camionesCount > 0) {
                    await Camion.update(
                        { camioneroId: null },
                        { where: { camioneroId: idNum }, transaction: t }
                    );
                }
                if (viajesCount > 0) {
                    await Viaje.update(
                        {
                            camioneroId: null,
                            camioneroNombre: usuario.nombre,
                            camioneroEmail: usuario.email
                        },
                        { where: { camioneroId: idNum }, transaction: t }
                    );
                }

                // Si el usuario fue quien creó adelantos/gastos fijos, preservar los registros pero despegar creadoPor.
                await Promise.all([
                    Adelanto.update({ creadoPor: null }, { where: { creadoPor: idNum }, transaction: t }),
                    GastoFijo.update({ creadoPor: null }, { where: { creadoPor: idNum }, transaction: t })
                ]);

                await Usuario.destroy({ where: { id: idNum }, transaction: t });
            });

            return res.json({ mensaje: 'Usuario eliminado' });
        } catch (error) {
            // Si queda alguna FK no contemplada, devolver conflicto con mensaje útil.
            if (error?.name === 'SequelizeForeignKeyConstraintError') {
                return res.status(409).json({ error: 'No se puede eliminar el usuario porque tiene datos asociados.' });
            }
            console.error('[usuarios] Error eliminando usuario:', error?.message || error);
            res.status(500).json({ error: 'Error al eliminar usuario' });
        }
    }
);

export default router;

// Probar envío de WhatsApp a un usuario (solo CEO)

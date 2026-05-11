import jwt from 'jsonwebtoken';
import Usuario from '../models/Usuario.js';

const normalizeRole = (rawRole) => {
    const role = String(rawRole || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    if (role === 'admin' || role === 'administrador' || role === 'administradora' || role === 'administracion') {
        return 'administracion';
    }
    if (role === 'chofer' || role === 'camionero') {
        return 'camionero';
    }
    if (role === 'ceo') {
        return 'ceo';
    }
    if (role === 'mantenimiento' || role === 'maintenance') {
        return 'mantenimiento';
    }
    return role;
};

export const authMiddleware = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token malformado' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const normalizedUserId = decoded?.id ?? decoded?.userId ?? decoded?.sub ?? null;
        const normalizedRole = normalizeRole(decoded?.rol ?? decoded?.role);

        if (!normalizedUserId) return res.status(401).json({ error: 'Token inválido' });

        // Si el usuario fue desactivado o no existe, bloquear acceso incluso con token válido.
        try {
            const u = await Usuario.findByPk(normalizedUserId, { attributes: ['id', 'activo'] });
            if (!u) return res.status(401).json({ error: 'Usuario no encontrado' });
            if (u.activo === false) return res.status(401).json({ error: 'Usuario desactivado' });
        } catch {
            return res.status(401).json({ error: 'Token inválido' });
        }

        decoded.id = normalizedUserId;
        decoded.rol = normalizedRole;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

export const roleMiddleware = (roles) => (req, res, next) => {
    const normalizedUserRole = normalizeRole(req.user?.rol);
    const normalizedAllowedRoles = (roles || []).map((r) => normalizeRole(r));
    if (!normalizedAllowedRoles.includes(normalizedUserRole)) {
        return res.status(403).json({ error: 'No autorizado' });
    }
    next();
};


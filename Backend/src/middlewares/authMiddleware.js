import jwt from 'jsonwebtoken';

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
    return role;
};

export const authMiddleware = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ error: 'No token' });
    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token malformado' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        decoded.rol = normalizeRole(decoded?.rol);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Token inválido' });
    }
};

export const roleMiddleware = (roles) => (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
        return res.status(403).json({ error: 'No autorizado' });
    }
    next();
};


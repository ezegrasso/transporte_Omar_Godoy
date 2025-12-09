import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('user');
        if (!saved) return null;
        try {
            const parsed = JSON.parse(saved);
            // Normalizar rol por si viene con mayúsculas u otros espacios
            if (parsed && parsed.rol) parsed.rol = String(parsed.rol).toLowerCase().trim();
            return parsed;
        } catch {
            return null;
        }
    });
    const [initializing, setInitializing] = useState(true);

    useEffect(() => {
        // Validar token al iniciar la app
        const boot = async () => {
            try {
                const token = localStorage.getItem('token');
                if (!token) { setUser(null); return; }
                // Usar endpoint de refresh del backend
                const api = (await import('../services/api')).default;
                const { data } = await api.get('/auth/refresh');
                const raw = data?.usuario || data || null;
                const normalized = raw ? { ...raw, rol: String(raw.rol || '').toLowerCase().trim() } : null;
                if (normalized) {
                    localStorage.setItem('user', JSON.stringify(normalized));
                } else {
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                }
                setUser(normalized);
            } catch {
                // Token inválido: limpiar
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                setUser(null);
            } finally {
                setInitializing(false);
            }
        };
        boot();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (email, password) => {
        const { data } = await api.post('/auth/login', { email, password });
        const usuario = { ...data.usuario, rol: String(data?.usuario?.rol || '').toLowerCase().trim() };
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(usuario));
        setUser(usuario);
        return usuario;
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
    };

    const refresh = async () => {
        const { data } = await api.get('/auth/refresh');
        const raw = data?.usuario || data || null;
        const normalized = raw ? { ...raw, rol: String(raw.rol || '').toLowerCase().trim() } : null;
        if (normalized) localStorage.setItem('user', JSON.stringify(normalized));
        setUser(normalized);
        return normalized;
    };

    const value = useMemo(() => ({ user, login, logout, refresh, initializing }), [user, initializing]);

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

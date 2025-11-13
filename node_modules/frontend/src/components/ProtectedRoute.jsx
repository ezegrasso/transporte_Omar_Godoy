import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, roles }) {
    const { user, initializing } = useAuth();
    if (initializing) return <div className="container py-5 text-center"><div className="spinner-border text-primary" role="status" /><p className="mt-2 text-body-secondary">Cargando…</p></div>;
    if (!user) return <Navigate to="/login" replace />;
    if (roles && !roles.includes(user.rol)) return <Navigate to="/" replace />;
    return children;
}

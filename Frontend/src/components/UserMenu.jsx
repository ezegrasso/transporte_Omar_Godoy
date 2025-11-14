import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

// Componente de avatar + dropdown (solo cerrar sesión)
export default function UserMenu() {
    const { user, logout } = useAuth();
    const [open, setOpen] = useState(false);

    if (!user) return null;

    const initials = (user.nombre || user.email || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="position-relative">
            <button type="button" className="btn btn-light border d-flex align-items-center gap-2" onClick={() => setOpen(o => !o)}>
                {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                    <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
                )}
                <span className="text-start d-none d-sm-inline" style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.nombre}</span>
                <i className={`bi bi-caret-${open ? 'up' : 'down'}-fill small`}></i>
            </button>
            {open && (
                <div className="dropdown-menu show end-0 mt-2 p-2 shadow-sm" style={{ minWidth: 220 }}>
                    {/* Solo dejar la opción de cerrar sesión */}
                    <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => { logout(); setOpen(false); }}>
                        <i className="bi bi-box-arrow-right"></i> Cerrar sesión
                    </button>
                </div>
            )}
        </div>
    );
}
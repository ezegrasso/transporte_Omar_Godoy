import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { useToast } from '../context/ToastContext';

// Componente de avatar + dropdown (solo cerrar sesión)
export default function UserMenu() {
    const { user, logout, refresh } = useAuth();
    const { showToast } = useToast();
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ nombre: '', email: '', password: '', avatarUrl: '' });

    if (!user) return null;

    const initials = (user.nombre || user.email || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
    const isCeo = String(user?.rol || '').toLowerCase() === 'ceo';


    const handleSave = async () => {
        setSaving(true);
        try {
            const body = {};
            const nombreTrim = form.nombre.trim();
            const emailTrim = form.email.trim();
            const avatarTrim = form.avatarUrl.trim();

            if (nombreTrim) body.nombre = nombreTrim;
            if (emailTrim) body.email = emailTrim;
            if (form.password.trim()) body.password = form.password.trim();
            if (avatarTrim) body.avatarUrl = avatarTrim;

            await api.put('/usuarios/me', body);
            await refresh();
            showToast('Perfil actualizado', 'success');
            setEditing(false);
            setForm(f => ({ ...f, password: '' }));
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error al guardar perfil';
            showToast(msg, 'error');
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        // Sincronizar el formulario con los datos actuales del usuario
        if (user && editing) {
            setForm({
                nombre: user.nombre || '',
                email: user.email || '',
                password: '',
                avatarUrl: user.avatarUrl || ''
            });
        }
    }, [user, editing]);

    useEffect(() => {
        if (editing) {
            setTimeout(() => {
                const el = document.getElementById('perfilNombre');
                if (el) try { el.focus(); } catch { }
            }, 50);
        }
    }, [editing]);

    return (
        <div className="position-relative">
            <button type="button" className="btn btn-light border d-flex align-items-center gap-2" onClick={() => setOpen(o => !o)}>
                {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="avatar" style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                    <div className="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center" style={{ width: 32, height: 32, fontSize: 12 }}>{initials}</div>
                )}
                <span className="text-start d-none d-sm-inline" style={{ maxWidth: 120, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.nombre}</span>
                {isCeo && (<i className={`bi bi-caret-${open ? 'up' : 'down'}-fill small`}></i>)}
            </button>
            {open && (
                <div className="dropdown-menu show end-0 mt-2 p-2 shadow-sm" style={{ minWidth: 220 }}>
                    <div className="small text-body-secondary mb-2">{user.email}</div>
                    {isCeo && (
                        <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => { setEditing(true); setOpen(false); }}>
                            <i className="bi bi-person-gear"></i> Editar perfil
                        </button>
                    )}
                    <button className="dropdown-item d-flex align-items-center gap-2" onClick={() => { logout(); setOpen(false); }}>
                        <i className="bi bi-box-arrow-right"></i> Cerrar sesión
                    </button>
                </div>
            )}
            {isCeo && editing && createPortal((
                <div>
                    <div className="modal fade show" style={{ display: 'block', zIndex: 1060 }} role="dialog" aria-modal="true">
                        <div className="modal-dialog" onClick={e => e.stopPropagation()}>
                            <div className="modal-content">
                                <div className="modal-header">
                                    <h1 className="modal-title fs-5">Editar perfil</h1>
                                    <button type="button" className="btn-close" onClick={() => setEditing(false)} aria-label="Cerrar"></button>
                                </div>
                                <div className="modal-body">
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="perfilNombre">Nombre</label>
                                        <input id="perfilNombre" className="form-control" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="perfilEmail">Email</label>
                                        <input id="perfilEmail" type="email" className="form-control" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="perfilPass">Nueva contraseña (opcional)</label>
                                        <input id="perfilPass" type="password" className="form-control" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                                        <small className="text-body-secondary">Dejar vacío para mantener la actual.</small>
                                    </div>
                                    <div className="mb-3">
                                        <label className="form-label" htmlFor="perfilAvatar">Avatar URL (opcional)</label>
                                        <input id="perfilAvatar" className="form-control" value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))} placeholder="https://..." />
                                        <small className="text-body-secondary">Puede ser un enlace a una imagen pública.</small>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button className="btn btn-secondary" disabled={saving} onClick={() => setEditing(false)}>Cancelar</button>
                                    <button className="btn btn-primary" disabled={saving} onClick={handleSave}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-backdrop fade show" style={{ zIndex: 1050 }}></div>
                </div>
            ), document.body)}
        </div>
    );
}
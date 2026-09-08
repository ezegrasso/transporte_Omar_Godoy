import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberEmail, setRememberEmail] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    // Cargar email recordado (si existe) al montar
    useEffect(() => {
        try {
            const saved = localStorage.getItem('app_login_email');
            if (saved) {
                setEmail(saved);
                setRememberEmail(true);
            }
        } catch {
            // ignore storage errors
        }
    }, []);

    const doLogin = async (em, pw) => {
        setError('');
        setLoading(true);
        try {
            const u = await login(em, pw);
            if (u.rol === 'ceo') navigate('/ceo');
            else if (u.rol === 'administracion') navigate('/administracion');
            else if (u.rol === 'mantenimiento') navigate('/mantenimiento');
            else navigate('/camionero');
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Error de login');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        // Persistir o limpiar email recordado
        try {
            if (rememberEmail && email.trim()) {
                localStorage.setItem('app_login_email', email.trim());
            } else {
                localStorage.removeItem('app_login_email');
            }
        } catch {
            // ignore storage errors
        }
        await doLogin(email, password);
    };

    return (
        <div className="auth-hero d-flex justify-content-center align-items-center py-5">
            <div className="card shadow-lg w-100 card-hover auth-card" style={{ maxWidth: 440, opacity: loading ? 0.9 : 1 }}>
                <div className="card-body p-4">
                    <div className="text-center mb-4">
                        <img src="/logo.svg" alt="Omar Godoy" width="72" height="72" className="mb-2" />
                        <h1 className="h4 fw-bold text-primary mb-0">OMAR GODOY</h1>
                        <p className="text-body-secondary small">Transporte</p>
                    </div>
                    <h2 className="h5 mb-2">Iniciar sesión</h2>
                    <p className="text-body-secondary small mb-4">Accedé al panel con tu cuenta</p>
                    <form onSubmit={onSubmit} className="space-y-3">
                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <input className="form-control form-control-lg" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@ejemplo.com" disabled={loading} />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <div className="position-relative">
                                <input
                                    className="form-control form-control-lg"
                                    style={{ paddingRight: '2.75rem' }}
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    disabled={loading}
                                />
                                {password.length > 0 && (
                                    <button
                                        type="button"
                                        className="btn btn-link position-absolute top-50 end-0 translate-middle-y text-body-secondary p-0 me-3"
                                        style={{ boxShadow: 'none', lineHeight: 1 }}
                                        tabIndex={-1}
                                        onClick={() => setShowPassword((v) => !v)}
                                        disabled={loading}
                                        aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="mb-3 form-check">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                id="rememberEmail"
                                checked={rememberEmail}
                                disabled={loading}
                                onChange={(e) => setRememberEmail(e.target.checked)}
                            />
                            <label className="form-check-label small" htmlFor="rememberEmail">
                                Recordar mi email en este dispositivo
                            </label>
                        </div>
                        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                        <button className="btn btn-primary w-100 btn-lg" type="submit" disabled={loading}>
                            {loading ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Entrando…</> : 'Entrar'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );

}

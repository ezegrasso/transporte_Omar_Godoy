import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('admin@example.com');
    const [password, setPassword] = useState('admin123');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const doLogin = async (em, pw) => {
        setError('');
        setLoading(true);
        try {
            const u = await login(em, pw);
            navigate(u.rol === 'admin' ? '/admin' : '/camionero');
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Error de login');
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (e) => {
        e.preventDefault();
        await doLogin(email, password);
    };

    return (
        <div className="auth-hero d-flex justify-content-center align-items-center py-5">
            <div className="card shadow-lg w-100 card-hover" style={{ maxWidth: 440, opacity: loading ? 0.9 : 1 }}>
                <div className="card-body p-4">
                    <div className="d-flex align-items-center gap-2 mb-2">
                        <i className="bi bi-truck-front-fill text-primary fs-4"></i>
                        <h2 className="card-title mb-0">Iniciar sesión</h2>
                    </div>
                    <p className="text-body-secondary small mb-4">Accedé al panel con tu cuenta</p>
                    <form onSubmit={onSubmit} className="space-y-3">
                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <input className="form-control form-control-lg" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@ejemplo.com" disabled={loading} />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <input className="form-control form-control-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={loading} />
                        </div>
                        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                        <button className="btn btn-primary w-100 btn-lg" type="submit" disabled={loading}>
                            {loading ? <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Entrando…</> : 'Entrar'}
                        </button>
                        <div className="mt-3">
                            <div className="text-center text-body-secondary small mb-2">Accesos rápidos</div>
                            <div className="d-grid gap-2">
                                <button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={() => doLogin('admin@example.com', 'admin123')}>
                                    Entrar como Admin demo
                                </button>
                                <button type="button" className="btn btn-outline-secondary" disabled={loading} onClick={() => doLogin('camionero@example.com', 'camion123')}>
                                    Entrar como Camionero demo
                                </button>
                                <div className="form-text text-center">Si el usuario camionero demo no existe, podés crearlo desde Admin.</div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );

}

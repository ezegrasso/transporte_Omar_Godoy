import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
    const [email, setEmail] = useState('ceo@example.com');
    const [password, setPassword] = useState('ceo123');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const doLogin = async (em, pw) => {
        setError('');
        setLoading(true);
        try {
            const u = await login(em, pw);
            if (u.rol === 'ceo') navigate('/ceo');
            else if (u.rol === 'administracion') navigate('/administracion');
            else navigate('/camionero');
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
                            <input className="form-control form-control-lg" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" disabled={loading} />
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

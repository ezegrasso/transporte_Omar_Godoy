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

    const onSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const u = await login(email, password);
            navigate(u.rol === 'admin' ? '/admin' : '/camionero');
        } catch (err) {
            setError(err?.response?.data?.error || err?.message || 'Error de login');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container d-flex justify-content-center align-items-center" style={{ minHeight: '70vh' }}>
            <div className="card shadow-sm w-100" style={{ maxWidth: 420, opacity: loading ? 0.9 : 1 }}>
                <div className="card-body">
                    <h2 className="card-title mb-3">Iniciar sesión</h2>
                    <form onSubmit={onSubmit} className="space-y-3">
                        <div className="mb-3">
                            <label className="form-label">Email</label>
                            <input className="form-control" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" disabled={loading} />
                        </div>
                        <div className="mb-3">
                            <label className="form-label">Password</label>
                            <input className="form-control" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" disabled={loading} />
                        </div>
                        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
                        <button className="btn btn-primary w-100" type="submit" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</button>
                    </form>
                </div>
            </div>
        </div>
    );

}

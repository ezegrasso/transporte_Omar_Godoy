import PageHeader from '../components/UI/PageHeader';
import { useAuth } from '../context/AuthContext';

export default function Administracion() {
    const { user } = useAuth();
    return (
        <div className="container py-3">
            <PageHeader title="Panel Administración" subtitle="Panel específico para el rol administración" />
            <div className="card shadow-sm">
                <div className="card-body">
                    <p className="mb-0">Hola <strong>{user?.nombre}</strong>. Este panel está listo. Decime qué módulos y métricas querés ver acá y lo implemento.</p>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
import { useToast } from '../context/ToastContext';

// Función segura para parsear números sin importar el formato local
const safeParseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    let clean = str.replace(/\s/g, '');
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
        if (lastComma > lastDot) {
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            clean = clean.replace(/,/g, '');
        }
    } else if (lastComma > -1 && lastComma === clean.length - 3) {
        clean = clean.replace(',', '.');
    } else if (lastDot > -1 && lastDot === clean.length - 3) {
        // keep as is
    } else if (lastComma > -1) {
        clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export default function Mantenimiento() {
    const { showToast } = useToast();
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Historial de adelantos (mes/año seleccionado)
    const [adelantos, setAdelantos] = useState([]);
    const [adelantosLoading, setAdelantosLoading] = useState(false);
    const [adelantosMes, setAdelantosMes] = useState(() => String(new Date().getMonth() + 1).padStart(2, '0'));
    const [adelantosAnio, setAdelantosAnio] = useState(() => String(new Date().getFullYear()));
    const [adelantosTotal, setAdelantosTotal] = useState(0);

    const formatMesAnioLabel = (mes, anio) => {
        try {
            const m = parseInt(mes);
            const a = parseInt(anio);
            if (Number.isNaN(m) || m < 1 || m > 12 || Number.isNaN(a)) return '';
            const labelMes = new Date(a, m - 1, 1).toLocaleString('es-AR', { month: 'long' });
            return `${labelMes} ${a}`;
        } catch {
            return '';
        }
    };

    const formatFechaHora = (dt) => {
        if (!dt) return '-';
        try {
            const d = new Date(dt);
            if (Number.isNaN(d.getTime())) return '-';
            return d.toLocaleString('es-AR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch {
            return '-';
        }
    };

    const fetchAdelantos = async (mes = adelantosMes, anio = adelantosAnio) => {
        try {
            setAdelantosLoading(true);
            const mesQ = encodeURIComponent(String(mes || '').trim());
            const anioQ = encodeURIComponent(String(anio || '').trim());
            const { data } = await api.get(`/adelantos/mis-adelantos?mes=${mesQ}&anio=${anioQ}`);
            setAdelantos(data?.adelantos || []);
            setAdelantosTotal(Number(data?.totalAdelanto || 0));
        } catch (e) {
            console.error('Error cargando adelantos:', e?.message);
            setAdelantos([]);
            setAdelantosTotal(0);
        } finally {
            setAdelantosLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        try {
            (async () => {
                await fetchAdelantos();
            })();
        } catch (e) {
            setError(e?.response?.data?.error || 'Error cargando datos');
            showToast(e?.response?.data?.error || 'Error cargando datos', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    if (loading) {
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-primary" role="status" />
                <p className="mt-2 text-body-secondary">Cargando información…</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 pb-4">
            <PageHeader
                icon={<i className="bi bi-wrench-adjustable text-warning" style={{ fontSize: '1.5rem' }} />}
                title="Panel de Mantenimiento"
                subtitle="Gestión de adelantos"
                showHome
            />

            {error && (
                <div className="alert alert-danger" role="alert">
                    {error}
                </div>
            )}

            {/* Historial de Adelantos */}
            <div className="card shadow-sm border-success">
                <div className="card-header bg-success bg-opacity-10 d-flex align-items-center gap-2 py-2">
                    <i className="bi bi-clock-history text-success" style={{ fontSize: '1.25rem' }}></i>
                    <h6 className="mb-0 fw-bold">Historial de adelantos</h6>
                </div>
                <div className="card-body">
                    <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
                        <div>
                            <label className="form-label mb-1 small text-muted">Mes</label>
                            <select
                                className="form-select form-select-sm"
                                value={adelantosMes}
                                onChange={(e) => {
                                    const newMes = e.target.value;
                                    setAdelantosMes(newMes);
                                    fetchAdelantos(newMes, adelantosAnio);
                                }}
                                disabled={adelantosLoading}
                                style={{ minWidth: 160 }}
                            >
                                {Array.from({ length: 12 }, (_, i) => {
                                    const val = String(i + 1).padStart(2, '0');
                                    const label = new Date(2020, i, 1).toLocaleString('es-AR', { month: 'long' });
                                    return <option key={val} value={val}>{label}</option>;
                                })}
                            </select>
                        </div>
                        <div>
                            <label className="form-label mb-1 small text-muted">Año</label>
                            <input
                                type="number"
                                className="form-control form-control-sm"
                                value={adelantosAnio}
                                min={2000}
                                max={3000}
                                onChange={(e) => {
                                    const newAnio = e.target.value;
                                    setAdelantosAnio(newAnio);
                                    fetchAdelantos(adelantosMes, newAnio);
                                }}
                                disabled={adelantosLoading}
                                style={{ width: 120 }}
                            />
                        </div>
                        <div className="ms-auto text-end">
                            <div className="small text-muted">{formatMesAnioLabel(adelantosMes, adelantosAnio) || 'Período seleccionado'}</div>
                            <div className="fw-semibold">
                                <span className="text-success">
                                    ${Number(adelantosTotal || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <span className="text-muted fw-normal ms-2">({adelantos.length} adelantos)</span>
                            </div>
                        </div>
                    </div>

                    {adelantosLoading ? (
                        <div className="text-center py-4">
                            <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                            <div className="text-muted small mt-2">Cargando adelantos...</div>
                        </div>
                    ) : adelantos.length === 0 ? (
                        <EmptyState
                            icon={<i className="bi bi-inbox"></i>}
                            title="Sin adelantos"
                            description={`No hay adelantos registrados en ${formatMesAnioLabel(adelantosMes, adelantosAnio) || 'este período'}.`}
                        />
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-sm table-hover mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th style={{ width: '20%' }}>Monto</th>
                                        <th style={{ width: '25%' }}>Fecha y hora</th>
                                        <th>Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {adelantos.map((adelanto) => (
                                        <tr key={adelanto.id}>
                                            <td className="fw-semibold text-success">
                                                ${safeParseNumber(adelanto.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="text-muted">
                                                {formatFechaHora(adelanto.updatedAt || adelanto.createdAt)}
                                            </td>
                                            <td className="text-muted">
                                                {adelanto.descripcion || '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

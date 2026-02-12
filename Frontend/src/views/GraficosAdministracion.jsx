import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import DashboardCharts from '../components/UI/DashboardCharts';

export default function GraficosAdministracion() {
    const { user } = useAuth();
    const [viajes, setViajes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { showToast } = useToast();

    // Filtros para gráficos
    const [chartFrom, setChartFrom] = useState('');
    const [chartTo, setChartTo] = useState('');
    const [chartCliente, setChartCliente] = useState('');
    const [chartTipo, setChartTipo] = useState('');

    const fetchViajes = async () => {
        const { data } = await api.get('/viajes?limit=100');
        const list = data.items || data.data || [];
        setViajes(list);
        return list;
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try {
                await fetchViajes();
            } catch (e) {
                const msg = e?.response?.data?.error || 'Error cargando viajes';
                setError(msg);
                showToast(msg, 'error');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Helper de fecha local
    const parseDateOnlyLocal = (s) => {
        if (!s) return 0;
        try {
            const [y, m, d] = String(s).split('-').map(Number);
            return new Date(y, (m || 1) - 1, d || 1).getTime();
        } catch {
            return 0;
        }
    };

    const tiposOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => {
            const t = v.tipoMercaderia?.trim();
            if (t) set.add(t);
        });
        return Array.from(set);
    }, [viajes]);

    const clientesOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => {
            const c = v.cliente?.trim();
            if (c) set.add(c);
        });
        return Array.from(set);
    }, [viajes]);

    // Filtrar viajes finalizados según los filtros de fecha, tipo y cliente
    const viajesFinalizados = useMemo(() => {
        return viajes.filter(v => {
            if (v.estado !== 'finalizado') return false;

            const okTipo = !chartTipo || (v.tipoMercaderia || '') === chartTipo;
            const okCliente = !chartCliente || (v.cliente || '') === chartCliente;

            const okFecha = (() => {
                if (!chartFrom && !chartTo) return true;
                const ts = parseDateOnlyLocal(v.fecha);
                const fromTs = chartFrom ? parseDateOnlyLocal(chartFrom) : null;
                const toTs = chartTo ? parseDateOnlyLocal(chartTo) : null;
                if (fromTs && ts < fromTs) return false;
                if (toTs && ts > toTs) return false;
                return true;
            })();

            return okTipo && okCliente && okFecha;
        });
    }, [viajes, chartFrom, chartTo, chartCliente, chartTipo]);

    return (
        <div className="container py-3">
            <PageHeader
                title="Graficos"
                subtitle={user?.nombre ? `Hola, ${user.nombre}` : 'Visualizacion de estadisticas de viajes'}
            />

            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            {loading ? (
                <div className="text-center py-5">
                    <span className="spinner-border spinner-border-lg text-primary" role="status" />
                    <p className="mt-2 text-body-secondary">Cargando datos...</p>
                </div>
            ) : (
                <div className="mb-3">
                    <div className="card shadow-sm mb-2">
                        <div className="card-body d-flex flex-wrap align-items-end gap-2">
                            <div>
                                <label className="form-label mb-1">Desde</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={chartFrom}
                                    onChange={e => setChartFrom(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label mb-1">Hasta</label>
                                <input
                                    type="date"
                                    className="form-control"
                                    value={chartTo}
                                    onChange={e => setChartTo(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="form-label mb-1">Cliente</label>
                                <select
                                    className="form-select"
                                    value={chartCliente}
                                    onChange={e => setChartCliente(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {clientesOpciones.map(c => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Tipo</label>
                                <select
                                    className="form-select"
                                    value={chartTipo}
                                    onChange={e => setChartTipo(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {tiposOpciones.map(t => (
                                        <option key={t} value={t}>
                                            {t}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                className="btn btn-outline-secondary ms-auto"
                                onClick={() => {
                                    setChartFrom('');
                                    setChartTo('');
                                    setChartCliente('');
                                    setChartTipo('');
                                }}
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                    <DashboardCharts
                        viajes={viajesFinalizados}
                        filtros={{
                            from: chartFrom,
                            to: chartTo,
                            cliente: chartCliente,
                            tipo: chartTipo
                        }}
                    />
                </div>
            )}
        </div>
    );
}

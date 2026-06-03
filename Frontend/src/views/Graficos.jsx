import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import DashboardCharts, { FacturacionAnualPorChoferChart } from '../components/UI/DashboardCharts';

export default function Graficos() {
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
    const [chartYear, setChartYear] = useState(String(new Date().getFullYear()));
    const [chartChoferes, setChartChoferes] = useState([]);
    const [choferMenuOpen, setChoferMenuOpen] = useState(false);
    const [lastChoferToggled, setLastChoferToggled] = useState(null);
    const lastToggledTimerRef = useRef(null);
    const [manualChoferesCleared, setManualChoferesCleared] = useState(false);
    const choferMenuRef = useRef(null);

    const fetchViajes = async () => {
        const { data } = await api.get('/viajes?limit=5000&order=DESC&sortBy=fecha');
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

    const yearsOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => {
            const year = String(v.fecha || '').slice(0, 4);
            if (year) set.add(year);
        });
        return Array.from(set).sort((a, b) => Number(b) - Number(a));
    }, [viajes]);

    const choferesOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => {
            const nombre = (v.camionero?.nombre || v.camioneroNombre || '').trim();
            if (nombre) set.add(nombre);
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [viajes]);

    useEffect(() => {
        if (choferesOpciones.length === 0) {
            if (chartChoferes.length !== 0) setChartChoferes([]);
            return;
        }

        const normalized = chartChoferes.filter(c => choferesOpciones.includes(c));
        if (normalized.length !== chartChoferes.length) {
            setChartChoferes(normalized.length > 0 ? normalized : choferesOpciones);
        }
    }, [chartChoferes, choferesOpciones]);

    useEffect(() => {
        if (choferesOpciones.length > 0 && chartChoferes.length === 0 && !manualChoferesCleared) {
            setChartChoferes(choferesOpciones);
        }
    }, [choferesOpciones, chartChoferes.length, manualChoferesCleared]);

    useEffect(() => {
        const onClickOutside = (event) => {
            if (choferMenuRef.current && !choferMenuRef.current.contains(event.target)) {
                setChoferMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onClickOutside);
        return () => {
            document.removeEventListener('mousedown', onClickOutside);
            if (lastToggledTimerRef.current) clearTimeout(lastToggledTimerRef.current);
        };
    }, []);

    const choferesFiltrados = useMemo(() => choferesOpciones, [choferesOpciones]);

    const selectedChoferLabels = useMemo(() => {
        if (chartChoferes.length === 0) return [];
        if (chartChoferes.length === choferesOpciones.length) return ['Todos los choferes'];
        return chartChoferes.slice(0, 3);
    }, [chartChoferes, choferesOpciones.length]);

    // Filtrar viajes finalizados según los filtros de fecha, tipo y cliente
    const toggleChofer = (nombre) => {
        setChartChoferes(prev => {
            const adding = !prev.includes(nombre);
            const next = adding ? [...prev, nombre] : prev.filter(item => item !== nombre);
            if (adding) {
                setLastChoferToggled(nombre);
                if (lastToggledTimerRef.current) clearTimeout(lastToggledTimerRef.current);
                lastToggledTimerRef.current = setTimeout(() => setLastChoferToggled(null), 700);
                // user manually added a chofer -> clear the manual 'cleared' flag
                setManualChoferesCleared(false);
            }
            return next;
        });
    };

    const seleccionarTodosLosChoferes = () => {
        setManualChoferesCleared(false);
        setChartChoferes(choferesOpciones);
    };
    const limpiarChoferes = () => {
        setManualChoferesCleared(true);
        setChartChoferes([]);
    };

    const resumenChoferes = chartChoferes.length === 0
        ? 'Seleccionar choferes'
        : chartChoferes.length === choferesOpciones.length
            ? 'Todos los choferes'
            : `${chartChoferes.length} choferes seleccionados`;

    return (
        <div className="container py-3">
            <PageHeader
                title="Gráficos"
                subtitle="Visualización de estadísticas de viajes"
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
                            <div>
                                <label className="form-label mb-1">Año</label>
                                <select
                                    className="form-select"
                                    value={chartYear}
                                    onChange={e => setChartYear(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {yearsOpciones.map(y => (
                                        <option key={y} value={y}>{y}</option>
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
                                    setChartYear(String(new Date().getFullYear()));
                                    setChartChoferes(choferesOpciones);
                                    setChoferMenuOpen(false);
                                }}
                                onTouchStart={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                    <DashboardCharts
                        viajes={viajes}
                        filtros={{
                            from: chartFrom,
                            to: chartTo,
                            cliente: chartCliente,
                            tipo: chartTipo,
                            year: chartYear,
                            selectedChoferes: chartChoferes,
                        }}
                    />

                    <div className="card shadow-sm my-3">
                        <div className="card-body d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <div>
                                <div className="fw-semibold">Choferes</div>
                                <small className="text-body-secondary">Usá este filtro para la facturación anual</small>
                            </div>
                            <small className="text-body-secondary">{chartChoferes.length}/{choferesOpciones.length || 0}</small>
                        </div>
                        <div className="card-body pt-0">
                            <div ref={choferMenuRef} className="position-relative chofer-selector" style={{ maxWidth: 760 }}>
                                <button
                                    type="button"
                                    className="form-select chofer-selector-btn text-start d-flex align-items-center justify-content-between gap-2 rounded-3"
                                    style={{ cursor: 'pointer', minHeight: 48, paddingTop: 10, paddingBottom: 10 }}
                                    onClick={() => setChoferMenuOpen(prev => !prev)}
                                    onTouchStart={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}
                                >
                                    <span className="text-truncate d-flex align-items-center gap-2 flex-wrap" style={{ maxWidth: '92%' }}>
                                        {selectedChoferLabels.length > 0 ? selectedChoferLabels.map((label) => (
                                            <span key={label} className={`badge rounded-pill text-bg-primary-subtle text-primary-emphasis border border-primary-subtle ${label === lastChoferToggled ? 'chip-added' : ''}`}>
                                                {label}
                                            </span>
                                        )) : (
                                            <span className="text-body-secondary">{resumenChoferes}</span>
                                        )}
                                        {chartChoferes.length > 3 && chartChoferes.length !== choferesOpciones.length && (
                                            <span className="badge rounded-pill text-bg-light text-body-secondary border">+{chartChoferes.length - 3}</span>
                                        )}
                                    </span>
                                    <i className={`bi ${choferMenuOpen ? 'bi-chevron-up' : 'bi-chevron-down'} text-body-secondary`} />
                                </button>
                                {choferMenuOpen && (
                                    <div className="dropdown-menu chofer-dropdown-menu show shadow-lg border-0 p-0 w-100 mt-2 rounded-4 overflow-hidden" style={{ top: '100%', left: 0, right: 0, position: 'absolute', zIndex: 20 }}>
                                        <div className="px-3 py-3 border-bottom bg-body-tertiary d-flex align-items-center justify-content-between gap-2">
                                            <div>
                                                <div className="fw-semibold">Elegí choferes</div>
                                            </div>
                                            <small className="text-body-secondary">{chartChoferes.length} seleccionados</small>
                                        </div>
                                        {/* Buscador removido por petición del usuario */}
                                        <div style={{ maxHeight: 260, overflowY: 'auto' }} className="p-2">
                                            {choferesFiltrados.length === 0 ? (
                                                <div className="text-body-secondary small px-2 py-3 text-center">No hay coincidencias.</div>
                                            ) : (
                                                <>
                                                    <div className="d-flex gap-2 px-2 pb-2">
                                                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={seleccionarTodosLosChoferes} onTouchStart={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}>
                                                            Todos
                                                        </button>
                                                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={limpiarChoferes} onTouchStart={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}>
                                                            Ninguno
                                                        </button>
                                                    </div>
                                                    <div className="list-group list-group-flush rounded-3 overflow-hidden border">
                                                        {choferesFiltrados.map((c) => {
                                                            const activo = chartChoferes.includes(c);
                                                            return (
                                                                <button
                                                                    key={c}
                                                                    type="button"
                                                                    className={`list-group-item list-group-item-action d-flex align-items-center justify-content-between ${activo ? 'active' : ''}`}
                                                                    onClick={() => toggleChofer(c)}
                                                                    onTouchStart={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}
                                                                >
                                                                    <span className="d-flex align-items-center gap-2">
                                                                        <span className={`rounded-circle ${activo ? 'bg-white' : 'bg-primary'} opacity-75`} style={{ width: 10, height: 10 }} />
                                                                        <span>{c}</span>
                                                                    </span>
                                                                    <i className={`bi ${activo ? 'bi-check2' : ''}`} />
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                        <div className="px-3 py-2 border-top bg-body-tertiary d-flex justify-content-between align-items-center">
                                            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setChoferMenuOpen(false); }} onTouchStart={() => { if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(8); }}>
                                                Cerrar
                                            </button>
                                            <small className="text-body-secondary">{choferesOpciones.length} disponibles</small>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <FacturacionAnualPorChoferChart
                        viajes={viajes}
                        year={chartYear}
                        selectedChoferes={chartChoferes}
                    />
                </div>
            )}
        </div>
    );
}

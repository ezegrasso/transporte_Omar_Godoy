import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
import { useToast } from '../context/ToastContext';
import { downloadCSV } from '../utils/csv';

export default function Camionero() {
    const [pendientes, setPendientes] = useState([]);
    const [mios, setMios] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [finalizarData, setFinalizarData] = useState({ km: '', combustible: '', kilosCargados: '' });
    const [takingId, setTakingId] = useState(null);
    const [finishingId, setFinishingId] = useState(null);
    // Paso extra de confirmación antes de ejecutar la finalización
    const [finalizarPasoConfirm, setFinalizarPasoConfirm] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);
    // Control de visibilidad del modal sin depender de Bootstrap JS
    const [showFinalizarModal, setShowFinalizarModal] = useState(false);
    const [filtroPend, setFiltroPend] = useState('');
    const [filtroMios, setFiltroMios] = useState('');
    const [estadoMios, setEstadoMios] = useState('en curso'); // 'todos' | 'en curso' | 'finalizado'
    const [pagePend, setPagePend] = useState(1);
    const [pageMios, setPageMios] = useState(1);
    const pageSize = 10;
    const [modalId, setModalId] = useState(null);
    const [sortPend, setSortPend] = useState({ key: 'fecha', dir: 'asc' });
    const [sortMios, setSortMios] = useState({ key: 'fecha', dir: 'desc' });
    const { showToast } = useToast();
    const [savedMioId, setSavedMioId] = useState(null);
    const [density, setDensity] = useState(() => localStorage.getItem('tableDensity') || 'comfortable');
    const compact = density === 'compact';
    useEffect(() => { localStorage.setItem('tableDensity', density) }, [density]);
    const enCursoRef = useRef(null);
    const [flashCard, setFlashCard] = useState(false);
    // Liquidación mensual
    const [liqModal, setLiqModal] = useState(false);
    const [liqMes, setLiqMes] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });
    const [liqAdelanto, setLiqAdelanto] = useState('');
    const [liqRes, setLiqRes] = useState(null);

    // Helpers de fecha (DATEONLY -> local)
    const parseDateOnlyLocal = (s) => {
        if (!s) return 0;
        try { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); } catch { return 0; }
    };
    const formatDateOnly = (s) => {
        if (!s) return '-';
        try { const [y, m, d] = String(s).split('-').map(Number); const dt = new Date(y, (m || 1) - 1, d || 1); return dt.toLocaleDateString(); } catch { return s; }
    };

    const fetchPendientes = async () => {
        const { data } = await api.get('/viajes?estado=pendiente&limit=100');
        setPendientes(data.items || data.data || []);
    };
    const fetchMios = async () => {
        // No pasar estado para que el backend (no ceo/administracion) devuelva todos los viajes del camionero
        const { data } = await api.get('/viajes?limit=100');
        const list = data.items || data.data || [];
        setMios(list);
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try { await Promise.all([fetchPendientes(), fetchMios()]); }
            catch (e) { setError(e?.response?.data?.error || 'Error cargando viajes'); }
            finally { setLoading(false); }
        })();
    }, []);

    // (Se mueve la inicialización de tooltips más abajo, luego de calcular las páginas)

    const pendientesFiltrados = useMemo(() => {
        const term = filtroPend.trim().toLowerCase();
        return pendientes.filter(v => !term || `${v.origen ?? ''} ${v.destino ?? ''} ${v.tipoMercaderia ?? ''} ${v.cliente ?? ''} ${v.camion?.patente ?? v.camionId ?? ''}`.toLowerCase().includes(term));
    }, [pendientes, filtroPend]);
    const pendientesOrdenados = useMemo(() => {
        const arr = [...pendientesFiltrados];
        const dir = sortPend.dir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            const getVal = (v, k) => {
                switch (k) {
                    case 'fecha': return parseDateOnlyLocal(v.fecha || 0);
                    case 'estado': return (v.estado || '').toLowerCase();
                    case 'origen': return (v.origen || '').toLowerCase();
                    case 'destino': return (v.destino || '').toLowerCase();
                    case 'tipo': return (v.tipoMercaderia || '').toLowerCase();
                    case 'cliente': return (v.cliente || '').toLowerCase();
                    case 'camion': return ((v.camion?.patente || v.camionId || '') + '').toString().toLowerCase();
                    default: return '';
                }
            }
            const va = getVal(a, sortPend.key);
            const vb = getVal(b, sortPend.key);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        return arr;
    }, [pendientesFiltrados, sortPend]);
    const totalPendPages = Math.max(1, Math.ceil(pendientesFiltrados.length / pageSize));
    const curPend = Math.min(pagePend, totalPendPages);
    const pendientesPagina = useMemo(() => {
        const start = (curPend - 1) * pageSize;
        return pendientesOrdenados.slice(start, start + pageSize);
    }, [pendientesOrdenados, curPend]);

    const miosFiltrados = useMemo(() => {
        const term = filtroMios.trim().toLowerCase();
        return mios
            .filter(v => estadoMios === 'todos' ? true : v.estado === estadoMios)
            .filter(v => !term || `${v.origen ?? ''} ${v.destino ?? ''} ${v.tipoMercaderia ?? ''} ${v.cliente ?? ''} ${v.camion?.patente ?? v.camionId ?? ''}`.toLowerCase().includes(term));
    }, [mios, filtroMios, estadoMios]);
    const miosOrdenados = useMemo(() => {
        const arr = [...miosFiltrados];
        const dir = sortMios.dir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            const getVal = (v, k) => {
                switch (k) {
                    case 'fecha': return parseDateOnlyLocal(v.fecha || 0);
                    case 'estado': return (v.estado || '').toLowerCase();
                    case 'origen': return (v.origen || '').toLowerCase();
                    case 'destino': return (v.destino || '').toLowerCase();
                    case 'tipo': return (v.tipoMercaderia || '').toLowerCase();
                    case 'cliente': return (v.cliente || '').toLowerCase();
                    case 'camion': return ((v.camion?.patente || v.camionId || '') + '').toString().toLowerCase();
                    default: return '';
                }
            }
            const va = getVal(a, sortMios.key);
            const vb = getVal(b, sortMios.key);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        return arr;
    }, [miosFiltrados, sortMios]);
    const totalMiosPages = Math.max(1, Math.ceil(miosFiltrados.length / pageSize));
    const curMios = Math.min(pageMios, totalMiosPages);
    const miosPagina = useMemo(() => {
        const start = (curMios - 1) * pageSize;
        return miosOrdenados.slice(start, start + pageSize);
    }, [miosOrdenados, curMios]);

    // Inicialización de tooltips de Bootstrap para celdas con data-bs-toggle="tooltip"
    // Ubicado después de calcular pendientesPagina/miosPagina para evitar TDZ
    useEffect(() => {
        try {
            const tooltipTriggerList = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            const instances = tooltipTriggerList
                .map(el => {
                    if (window.bootstrap?.Tooltip) {
                        return window.bootstrap.Tooltip.getOrCreateInstance(el);
                    }
                    return null;
                })
                .filter(Boolean);
            return () => {
                instances.forEach(inst => {
                    try { inst.hide(); } catch { }
                    try { inst.dispose(); } catch { }
                });
            };
        } catch {
            // noop
        }
        // Re-ejecutar cuando cambien los datos/paginación/orden
    }, [pendientesPagina, pendientesOrdenados, pendientesFiltrados, sortPend, curPend, miosPagina, miosOrdenados, miosFiltrados, sortMios, curMios]);

    // Viaje en curso actual (normalmente hay 1). Tomamos el más reciente por fecha.
    const viajeEnCursoActual = useMemo(() => {
        const enCurso = mios.filter(v => v.estado === 'en curso');
        if (enCurso.length === 0) return null;
        return enCurso.sort((a, b) => parseDateOnlyLocal(b.fecha || 0) - parseDateOnlyLocal(a.fecha || 0))[0];
    }, [mios]);

    const viajeSeleccionado = useMemo(() => mios.find(v => v.id === modalId) || null, [mios, modalId]);

    const openFinalizarModal = (id) => {
        setModalId(id);
        setFinalizarData({ km: '', combustible: '', kilosCargados: '' });
        setFinalizarPasoConfirm(false);
        setConfirmChecked(false);
        // Abrir modal: si hay Bootstrap JS lo usa; si no, fallback por estado
        setTimeout(() => {
            try {
                const el = document.getElementById('modalFinalizar');
                if (el && window.bootstrap?.Modal) {
                    const modal = window.bootstrap.Modal.getOrCreateInstance(el);
                    modal.show();
                } else {
                    setShowFinalizarModal(true);
                }
            } catch {
                setShowFinalizarModal(true);
            }
        }, 50);
    };

    const tomar = async (id) => {
        setError('');
        setTakingId(id);
        try {
            await api.patch(`/viajes/${id}/tomar`);
            await Promise.all([fetchPendientes(), fetchMios()]);
            showToast('Viaje tomado', 'success');
            setSavedMioId(id);
            // Resaltar la fila por más tiempo para que se note mejor
            setTimeout(() => setSavedMioId(null), 5000);
            // Abrir modal de detalle automáticamente
            openFinalizarModal(id);
            // Hacer scroll a la tarjeta de viaje en curso y resaltar brevemente
            setTimeout(() => {
                enCursoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setFlashCard(true);
                setTimeout(() => setFlashCard(false), 1200);
            }, 150);
        } catch (e) {
            const msg = e?.response?.data?.error || 'No se pudo tomar el viaje';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setTakingId(null);
        }
    };

    const finalizar = async (id) => {
        setError('');
        // Primera pulsación: pasar a paso confirmación y mostrar resumen
        if (!finalizarPasoConfirm) {
            // Bloquear si no ingresó datos
            if (String(finalizarData.km).trim() === '' || String(finalizarData.combustible).trim() === '') {
                showToast('Completá km y combustible', 'error');
                return;
            }
            // Validar datos mínimos antes de pasar a confirmación
            const kmNum = Number(finalizarData.km);
            const combNum = Number(finalizarData.combustible);
            if (isNaN(kmNum) || kmNum <= 0) {
                showToast('Ingresá KM mayor a 0', 'error');
                return;
            }
            if (isNaN(combNum) || combNum <= 0) {
                showToast('Ingresá combustible mayor a 0', 'error');
                return;
            }
            setFinalizarPasoConfirm(true);
            return;
        }
        // Segunda pulsación: enviar
        setFinishingId(id);
        try {
            const body = { km: Number(finalizarData.km), combustible: Number(finalizarData.combustible) };
            if (String(finalizarData.kilosCargados).trim() !== '') body.kilosCargados = Number(finalizarData.kilosCargados);
            await api.patch(`/viajes/${id}/finalizar`, body);
            setFinalizarData({ km: '', combustible: '', kilosCargados: '' });
            setSavedMioId(id);
            await new Promise(r => setTimeout(r, 400));
            await Promise.all([fetchPendientes(), fetchMios()]);
            setTimeout(() => setSavedMioId(null), 2000);
            showToast('Viaje finalizado', 'success');
            try {
                const el = document.getElementById('modalFinalizar');
                if (el && window.bootstrap?.Modal) {
                    const modal = window.bootstrap.Modal.getOrCreateInstance(el);
                    modal.hide();
                }
            } catch { /* no-op */ }
            setShowFinalizarModal(false);
            setModalId(null);
        } catch (e) {
            const msg = e?.response?.data?.error || 'No se pudo finalizar';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setFinishingId(null);
        }
    };

    const cancelar = async (id) => {
        if (!confirm('¿Devolver este viaje a pendientes?')) return;
        setError('');
        try {
            await api.patch(`/viajes/${id}/cancelar`);
            await Promise.all([fetchPendientes(), fetchMios()]);
            showToast('Viaje devuelto a pendientes', 'success');
        } catch (e) {
            const msg = e?.response?.data?.error || 'No se pudo cancelar';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    return (
        <div className="container py-3 space-y-4">
            <PageHeader title="Panel Camionero" subtitle="Toma y finalización de viajes" actions={loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" />} showUserMenu={true} />
            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            {viajeEnCursoActual && (
                <div ref={enCursoRef} className={`card shadow-sm border-success ${flashCard ? 'row-saved-anim' : ''}`}>
                    <div className="card-body">
                        <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                            <div className="d-flex align-items-center gap-2">
                                <h3 className="h6 mb-0">Viaje en curso</h3>
                                {(flashCard || (savedMioId && viajeEnCursoActual?.id === savedMioId)) && (
                                    <span className="badge rounded-pill text-bg-primary">Nuevo</span>
                                )}
                            </div>
                            <span className="badge badge-dot badge-estado-en_curso text-capitalize">{viajeEnCursoActual.estado}</span>
                        </div>
                        <div className="row g-2 small mb-3">
                            <div className="col-12 col-sm-6">
                                <div><strong>Fecha:</strong> {formatDateOnly(viajeEnCursoActual.fecha)}</div>
                                <div><strong>Origen:</strong> {viajeEnCursoActual.origen}</div>
                                <div><strong>Destino:</strong> {viajeEnCursoActual.destino}</div>
                            </div>
                            <div className="col-12 col-sm-6">
                                <div><strong>Camión:</strong> {viajeEnCursoActual.camion ? `${viajeEnCursoActual.camion.patente} (${viajeEnCursoActual.camion.marca})` : viajeEnCursoActual.camionId}</div>
                                <div><strong>Tipo:</strong> {viajeEnCursoActual.tipoMercaderia || '-'}</div>
                                <div><strong>Cliente:</strong> {viajeEnCursoActual.cliente || '-'}</div>
                                <div><strong>Km cargados:</strong> {viajeEnCursoActual.km ?? '-'}</div>
                                <div><strong>Combustible:</strong> {viajeEnCursoActual.combustible ?? '-'}</div>
                            </div>
                        </div>
                        <div className="border rounded p-3">
                            <div className="d-flex justify-content-center gap-3 flex-wrap">
                                <button
                                    className="btn btn-sm btn-outline-warning px-4"
                                    onClick={() => cancelar(viajeEnCursoActual.id)}
                                >
                                    Cancelar viaje
                                </button>
                                <button
                                    className="btn btn-sm btn-success px-4"
                                    disabled={finishingId === viajeEnCursoActual.id}
                                    onClick={() => openFinalizarModal(viajeEnCursoActual.id)}
                                >
                                    {finishingId === viajeEnCursoActual.id ? 'Finalizando…' : 'Finalizar viaje'}
                                </button>
                            </div>
                        </div>
                        <small className="text-body-secondary d-block mt-2">Al finalizar, se registrará el km, el combustible y las toneladas cargadas y el CEO podrá verlo en su panel.</small>
                    </div>
                </div>
            )}

            <div className="card shadow-sm">
                <div className="card-body">
                    <div className="d-flex align-items-end gap-2 mb-3 flex-wrap">
                        <h3 className="h5 mb-0 me-auto">Viajes pendientes</h3>
                        <div className="form-check form-switch d-flex align-items-center gap-2">
                            <input className="form-check-input" type="checkbox" role="switch" id="switchDensityCamionero" checked={compact} onChange={e => setDensity(e.target.checked ? 'compact' : 'comfortable')} />
                            <label className="form-check-label" htmlFor="switchDensityCamionero">Compacto</label>
                        </div>
                        <div>
                            <label className="form-label mb-1">Buscar</label>
                            <input className="form-control form-control-sm" placeholder="Origen, destino, tipo, cliente, patente" value={filtroPend} onChange={e => { setFiltroPend(e.target.value); setPagePend(1); }} />
                        </div>
                        <div className="ms-auto">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Tipo', 'Cliente', 'Camión']
                                const rows = pendientesOrdenados.map(v => [
                                    formatDateOnly(v.fecha), v.estado || '', v.origen || '', v.destino || '', v.tipoMercaderia || '', v.cliente || '', v.camion?.patente || v.camionId || ''
                                ])
                                downloadCSV('pendientes.csv', headers, rows)
                                showToast('Exportado pendientes', 'success')
                            }}>
                                <i className="bi bi-filetype-csv me-1"></i> Exportar
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        {pendientesFiltrados.length === 0 ? (
                            <EmptyState title="Sin pendientes" description="No hay viajes para tomar" />
                        ) : (
                            <table className={`table ${compact ? 'table-sm' : ''} table-striped table-hover align-middle table-sticky`}>
                                <thead>
                                    <tr>
                                        {['fecha', 'estado', 'origen', 'destino', 'tipo', 'cliente', 'camion'].map((k) => (
                                            <th key={k} role="button" onClick={() => {
                                                setSortPend(s => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))
                                            }}>
                                                <span className="me-1 text-capitalize">{k}</span>
                                                {sortPend.key === k ? (
                                                    <i className={`bi ${sortPend.dir === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`}></i>
                                                ) : (
                                                    <i className="bi bi-arrow-down-up opacity-75"></i>
                                                )}
                                            </th>
                                        ))}
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendientesPagina.map(v => (
                                        <tr key={v.id}>
                                            <td>
                                                {formatDateOnly(v.fecha)}
                                                {savedMioId === v.id && (
                                                    <span className="badge rounded-pill text-bg-info ms-2">Nuevo</span>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`badge badge-dot ${v.estado === 'finalizado'
                                                    ? 'badge-estado-finalizado'
                                                    : v.estado === 'en curso'
                                                        ? 'badge-estado-en_curso'
                                                        : 'badge-estado-pendiente'
                                                    } text-capitalize`}>{v.estado}</span>
                                            </td>
                                            <td title={v.origen} data-bs-toggle="tooltip">{v.origen}</td>
                                            <td title={v.destino} data-bs-toggle="tooltip">{v.destino}</td>
                                            <td title={v.tipoMercaderia || ''} data-bs-toggle="tooltip">{v.tipoMercaderia || '-'}</td>
                                            <td title={v.cliente || ''} data-bs-toggle="tooltip">{v.cliente || '-'}</td>
                                            <td title={v.camion ? `${v.camion.patente} • ${v.camion.marca} ${v.camion.modelo}` : v.camionId} data-bs-toggle="tooltip">
                                                {v.camion ? (
                                                    <span>{v.camion.patente} <small className="text-body-secondary">({v.camion.marca})</small></span>
                                                ) : v.camionId}
                                            </td>
                                            <td className="text-end">
                                                <button className="btn btn-sm btn-primary" onClick={() => tomar(v.id)} disabled={takingId === v.id}>
                                                    {takingId === v.id ? 'Tomando…' : 'Tomar'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <small className="text-body-secondary">Mostrando {(pendientesPagina.length && (curPend - 1) * pageSize + 1) || 0} - {(curPend - 1) * pageSize + pendientesPagina.length} de {pendientesFiltrados.length}</small>
                        <div className="btn-group btn-group-sm" role="group">
                            <button className="btn btn-outline-secondary" disabled={curPend <= 1} onClick={() => setPagePend(p => Math.max(1, p - 1))}>Anterior</button>
                            <button className="btn btn-outline-secondary" disabled={curPend >= totalPendPages} onClick={() => setPagePend(p => Math.min(totalPendPages, p + 1))}>Siguiente</button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm">
                <div className="card-body">
                    <div className="d-flex align-items-end gap-2 mb-3 flex-wrap">
                        <h3 className="h5 mb-0 me-auto">Mis viajes</h3>
                        <button
                            className="btn btn-primary btn-md rounded-pill d-flex align-items-center gap-2 px-3"
                            style={{
                                backgroundImage: 'linear-gradient(135deg, var(--bs-primary) 0%, #6ea8fe 100%)',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.12)'
                            }}
                            title="Calculá tu liquidación mensual (16%)"
                            aria-label="Abrir liquidación final"
                            onClick={() => setLiqModal(true)}
                        >
                            <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-light text-primary" style={{ width: 24, height: 24 }}>
                                <i className="bi bi-calculator"></i>
                            </span>
                            <span className="fw-semibold">Liquidación final</span>
                        </button>
                        <div className="form-check form-switch d-flex align-items-center gap-2">
                            <input className="form-check-input" type="checkbox" role="switch" id="switchDensityCamionero2" checked={compact} onChange={e => setDensity(e.target.checked ? 'compact' : 'comfortable')} />
                            <label className="form-check-label" htmlFor="switchDensityCamionero2">Compacto</label>
                        </div>
                        <div>
                            <label className="form-label mb-1">Estado</label>
                            <select className="form-select form-select-sm" value={estadoMios} onChange={e => { setEstadoMios(e.target.value); setPageMios(1); }}>
                                <option value="en curso">En curso</option>
                                <option value="finalizado">Finalizado</option>
                                <option value="todos">Todos</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label mb-1">Buscar</label>
                            <input className="form-control form-control-sm" placeholder="Origen, destino, tipo, cliente, patente" value={filtroMios} onChange={e => { setFiltroMios(e.target.value); setPageMios(1); }} />
                        </div>
                        <div className="ms-auto">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Tipo', 'Cliente', 'Camión', 'Km', 'Combustible']
                                const rows = miosOrdenados.map(v => [
                                    formatDateOnly(v.fecha), v.estado || '', v.origen || '', v.destino || '', v.tipoMercaderia || '', v.cliente || '', v.camion?.patente || v.camionId || '', v.km ?? '', v.combustible ?? ''
                                ])
                                downloadCSV(`mis_viajes_${estadoMios}.csv`, headers, rows)
                                showToast('Exportado mis viajes', 'success')
                            }}>
                                <i className="bi bi-filetype-csv me-1"></i> Exportar
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        {miosFiltrados.length === 0 ? (
                            <EmptyState title="Sin viajes en curso" description="Tomá un viaje para comenzar" />
                        ) : (
                            <table className={`table ${compact ? 'table-sm' : ''} table-striped table-hover align-middle table-sticky`}>
                                <thead>
                                    <tr>
                                        {['fecha', 'estado', 'origen', 'destino', 'tipo', 'cliente', 'camion'].map((k) => (
                                            <th key={k} role="button" onClick={() => {
                                                setSortMios(s => ({ key: k, dir: s.key === k && s.dir === 'asc' ? 'desc' : 'asc' }))
                                            }}>
                                                <span className="me-1 text-capitalize">{k}</span>
                                                {sortMios.key === k ? (
                                                    <i className={`bi ${sortMios.dir === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`}></i>
                                                ) : (
                                                    <i className="bi bi-arrow-down-up opacity-75"></i>
                                                )}
                                            </th>
                                        ))}
                                        <th>Km</th>
                                        <th>Combustible</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {miosPagina.map(v => (
                                        <tr key={v.id} className={savedMioId === v.id ? 'table-warning row-saved-anim' : ''}>
                                            <td>{formatDateOnly(v.fecha)}</td>
                                            <td>
                                                <span className={`badge badge-dot ${v.estado === 'finalizado'
                                                    ? 'badge-estado-finalizado'
                                                    : v.estado === 'en curso'
                                                        ? 'badge-estado-en_curso'
                                                        : 'badge-estado-pendiente'
                                                    } text-capitalize`}>{v.estado}</span>
                                            </td>
                                            <td title={v.origen} data-bs-toggle="tooltip">{v.origen}</td>
                                            <td title={v.destino} data-bs-toggle="tooltip">{v.destino}</td>
                                            <td title={v.tipoMercaderia || ''} data-bs-toggle="tooltip">{v.tipoMercaderia || '-'}</td>
                                            <td title={v.cliente || ''} data-bs-toggle="tooltip">{v.cliente || '-'}</td>
                                            <td title={v.camion?.patente || v.camionId} data-bs-toggle="tooltip">{v.camion?.patente || v.camionId}</td>
                                            <td>{v.km ?? '-'}</td>
                                            <td>{v.combustible ?? '-'}</td>
                                            <td className="text-end">
                                                {v.estado === 'en curso' && (
                                                    <div className="btn-group btn-group-sm">
                                                        <button className="btn btn-success" onClick={() => openFinalizarModal(v.id)}>Finalizar</button>
                                                        <button className="btn btn-outline-warning" onClick={() => cancelar(v.id)}>Cancelar</button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                    <div className="d-flex justify-content-between align-items-center mt-2">
                        <small className="text-body-secondary">Mostrando {(miosPagina.length && (curMios - 1) * pageSize + 1) || 0} - {(curMios - 1) * pageSize + miosPagina.length} de {miosFiltrados.length}</small>
                        <div className="btn-group btn-group-sm" role="group">
                            <button className="btn btn-outline-secondary" disabled={curMios <= 1} onClick={() => setPageMios(p => Math.max(1, p - 1))}>Anterior</button>
                            <button className="btn btn-outline-secondary" disabled={curMios >= totalMiosPages} onClick={() => setPageMios(p => Math.min(totalMiosPages, p + 1))}>Siguiente</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Finalizar */}
            <div className={`modal ${showFinalizarModal ? 'show d-block' : 'fade'}`} id="modalFinalizar" tabIndex="-1" aria-hidden={!showFinalizarModal}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">Finalizar viaje</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={() => setShowFinalizarModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            {viajeSeleccionado && (
                                <div className="mb-3 small">
                                    <div className="row g-2">
                                        <div className="col-12 col-sm-6">
                                            <div><strong>Fecha:</strong> {formatDateOnly(viajeSeleccionado.fecha)}</div>
                                            <div><strong>Origen:</strong> {viajeSeleccionado.origen}</div>
                                            <div><strong>Destino:</strong> {viajeSeleccionado.destino}</div>
                                        </div>
                                        <div className="col-12 col-sm-6">
                                            <div><strong>Camión:</strong> {viajeSeleccionado.camion?.patente || viajeSeleccionado.camionId}</div>
                                            <div><strong>Tipo:</strong> {viajeSeleccionado.tipoMercaderia || '-'}</div>
                                            <div><strong>Cliente:</strong> {viajeSeleccionado.cliente || '-'}</div>
                                            <div><strong>Km (actual):</strong> {viajeSeleccionado.km ?? '-'}</div>
                                            <div><strong>Combustible (actual):</strong> {viajeSeleccionado.combustible ?? '-'}
                                            </div>
                                            <div><strong>Toneladas cargadas:</strong> {viajeSeleccionado.kilosCargados ?? '-'}</div>
                                        </div>
                                    </div>
                                    <hr />
                                </div>
                            )}
                            {!finalizarPasoConfirm ? (
                                <div className="row g-2">
                                    <div className="col-6">
                                        <label className="form-label">Km</label>
                                        <input className="form-control" type="number" min={1} value={finalizarData.km} onChange={e => setFinalizarData(x => ({ ...x, km: e.target.value }))} />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label">Combustible</label>
                                        <input className="form-control" type="number" min={0.1} step={0.1} value={finalizarData.combustible} onChange={e => setFinalizarData(x => ({ ...x, combustible: e.target.value }))} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Toneladas cargadas</label>

                                        <input className="form-control" type="number" min={0} step={1} value={finalizarData.kilosCargados} onChange={e => setFinalizarData(x => ({ ...x, kilosCargados: e.target.value }))} />
                                        <small className="text-body-secondary">Si el CEO definió precio por tonelada, se calculará automáticamente el importe del viaje.</small>
                                    </div>
                                    <div className="col-12 mt-2">
                                        <div className="alert alert-warning py-2 mb-0 small">
                                            Después de pulsar "Continuar" verás un resumen y deberás confirmar nuevamente.
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="border rounded p-2 bg-body-tertiary">
                                    <h6 className="mb-2">Confirmación final</h6>
                                    <p className="small mb-2">Revisá los datos antes de finalizar definitivamente el viaje:</p>
                                    <ul className="small mb-2">
                                        <li><strong>Km a registrar:</strong> {finalizarData.km}</li>
                                        <li><strong>Combustible a registrar:</strong> {finalizarData.combustible}</li>
                                        <li><strong>Viaje:</strong> #{viajeSeleccionado?.id} {viajeSeleccionado?.origen} → {viajeSeleccionado?.destino}</li>
                                        <li><strong>Toneladas a registrar:</strong> {finalizarData.kilosCargados || '—'}</li>
                                    </ul>
                                    <div className="alert alert-danger py-2 small mb-2">
                                        Una vez finalizado el viaje, no podrás volverlo a "en curso" (solo cancelar antes de confirmar).
                                    </div>
                                    <div className="form-check mb-0">
                                        <input className="form-check-input" type="checkbox" id="chkConfirmFinalizar"
                                            checked={confirmChecked}
                                            onChange={(e) => setConfirmChecked(e.target.checked)} />
                                        <label className="form-check-label small" htmlFor="chkConfirmFinalizar">Entiendo que esta acción es definitiva y confirmo finalizar el viaje</label>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            {!finalizarPasoConfirm ? (
                                <>
                                    <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={() => setShowFinalizarModal(false)}>Cerrar</button>
                                    <button type="button" className="btn btn-primary" disabled={!modalId || Number(finalizarData.km) <= 0 || Number(finalizarData.combustible) <= 0} onClick={() => modalId && finalizar(modalId)}>
                                        Continuar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setFinalizarPasoConfirm(false)} disabled={finishingId === modalId}>Volver</button>
                                    <button type="button" className="btn btn-danger" disabled={!modalId || finishingId === modalId || !confirmChecked || Number(finalizarData.km) <= 0 || Number(finalizarData.combustible) <= 0} onClick={() => modalId && finalizar(modalId)}>
                                        {finishingId === modalId ? 'Finalizando…' : 'Finalizar viaje'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showFinalizarModal && <div className="modal-backdrop show"></div>}

            {/* Modal Liquidación */}
            <div className={`modal ${liqModal ? 'show d-block' : 'fade'}`} id="modalLiquidacion" tabIndex="-1" aria-hidden={!liqModal}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5 d-flex align-items-center gap-2">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-primary-subtle text-primary" style={{ width: 28, height: 28 }}>
                                    <i className="bi bi-calculator"></i>
                                </span>
                                <span>Liquidación mensual</span>
                            </h1>
                            <button type="button" className="btn-close" onClick={() => { setLiqModal(false); setLiqRes(null); }}></button>
                        </div>
                        <div className="modal-body">
                            <div className="row g-2 mb-2">
                                <div className="col-6">
                                    <label className="form-label">Mes</label>
                                    <input className="form-control" type="month" value={liqMes} onChange={e => setLiqMes(e.target.value)} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Adelanto</label>
                                    <input className="form-control" type="number" min={0} step={0.01} value={liqAdelanto} onChange={e => setLiqAdelanto(e.target.value)} placeholder="Ej: 50000" />
                                </div>
                            </div>
                            <button className="btn btn-primary" onClick={async () => {
                                try {
                                    const { data } = await api.get(`/viajes/liquidacion`, { params: { mes: liqMes, adelanto: liqAdelanto || 0 } });
                                    setLiqRes(data);
                                } catch (e) {
                                    const msg = e?.response?.data?.error || 'Error calculando liquidación';
                                    showToast(msg, 'error');
                                }
                            }}>Calcular</button>
                            {liqRes && (
                                <div className="mt-3">
                                    <div className="alert alert-info">
                                        <div><strong>Mes:</strong> {liqRes.mes}</div>
                                        <div><strong>Bruto:</strong> ${liqRes.bruto?.toFixed ? liqRes.bruto.toFixed(2) : liqRes.bruto}</div>
                                        <div><strong>Sueldo:</strong> ${liqRes.sueldo?.toFixed ? liqRes.sueldo.toFixed(2) : liqRes.sueldo}</div>
                                        <div><strong>Adelanto:</strong> ${Number(liqRes.adelanto || 0).toFixed(2)}</div>
                                        <div><strong>Neto:</strong> ${liqRes.neto?.toFixed ? liqRes.neto.toFixed(2) : liqRes.neto}</div>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-striped">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Origen</th>
                                                    <th>Destino</th>
                                                    <th>Toneladas</th>
                                                    <th>Precio/Tn</th>
                                                    <th>Importe</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(!liqRes.viajes || liqRes.viajes.length === 0) && (
                                                    <tr>
                                                        <td colSpan={6} className="text-center text-muted">
                                                            No hay viajes para liquidar en este mes.
                                                        </td>
                                                    </tr>
                                                )}
                                                {liqRes.viajes?.map(v => (
                                                    <tr key={v.id}>
                                                        <td>{formatDateOnly(v.fecha)}</td>
                                                        <td>{v.origen}</td>
                                                        <td>{v.destino}</td>
                                                        <td>{v.kilosCargados ?? '-'}</td>
                                                        <td>{v.precioTonelada ?? '-'}</td>
                                                        <td>{v.importe ?? '-'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => { setLiqModal(false); setLiqRes(null); }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
            {liqModal && <div className="modal-backdrop show"></div>}
        </div>
    );
}

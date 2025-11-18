import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import StatCard from '../components/UI/StatCard';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
import { downloadCSV } from '../utils/csv';
import { useToast } from '../context/ToastContext';

export default function Administracion() {
    const buildUrl = (u) => {
        try {
            const base = api?.defaults?.baseURL || window.location.origin;
            return new URL(u, base).toString();
        } catch { return u || '#'; }
    };
    const isImageUrl = (u) => {
        try { const p = buildUrl(u).split('?')[0].toLowerCase(); return ['.jpg', '.jpeg', '.png', '.webp', '.gif'].some(ext => p.endsWith(ext)); } catch { return false; }
    };
    const isPdfUrl = (u) => {
        try { const p = buildUrl(u).split('?')[0].toLowerCase(); return p.endsWith('.pdf'); } catch { return false; }
    };
    const { user } = useAuth();
    const [viajes, setViajes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { showToast } = useToast();
    const AUTO_OPEN_THRESHOLD = Number(import.meta?.env?.VITE_NOTIS_AUTO_OPEN_THRESHOLD ?? 3);
    const [weekStart, setWeekStart] = useState(() => {
        const d = new Date();
        const day = d.getDay(); // 0=Dom
        const diff = (day === 0 ? 6 : day - 1); // Lunes como inicio
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
        return monday.toISOString().slice(0, 10);
    });
    const [weekEnd, setWeekEnd] = useState(() => {
        const start = new Date(weekStart);
        const sunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        return sunday.toISOString().slice(0, 10);
    });

    // Estados y lógica de notificaciones (mantenerlos fuera de efectos para evitar errores de hooks)
    const [notisOpen, setNotisOpen] = useState(false);
    const [notis, setNotis] = useState([]);
    const [loadingNotis, setLoadingNotis] = useState(false);
    const [bellPulse, setBellPulse] = useState(false);
    const unreadCount = useMemo(() => (notis || []).filter(n => !n.leida).length, [notis]);
    const prevUnreadRef = useRef(unreadCount);

    const playBeep = () => {
        try {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) return;
            const ctx = new Ctx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = 880;
            osc.connect(gain);
            gain.connect(ctx.destination);
            gain.gain.setValueAtTime(0.001, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
            osc.start();
            osc.stop(ctx.currentTime + 0.21);
            setTimeout(() => ctx.close().catch(() => { }), 300);
        } catch { /* ignorar */ }
    };

    const fetchNotis = async () => {
        if (user?.rol !== 'ceo') return;
        setLoadingNotis(true);
        try {
            const { data } = await api.get('/api/notificaciones');
            const list = data || [];
            setNotis(list);
            const nextUnread = (list || []).filter(n => !n.leida).length;
            const prevUnread = prevUnreadRef.current ?? 0;
            if (nextUnread > prevUnread) {
                const delta = nextUnread - prevUnread;
                showToast(`+${delta} notificaciones nuevas`, 'info');
                playBeep();
                setBellPulse(true);
                setTimeout(() => setBellPulse(false), 1200);
                if (delta >= AUTO_OPEN_THRESHOLD && !notisOpen) {
                    setNotisOpen(true);
                }
            }
            prevUnreadRef.current = nextUnread;
        } catch { /* ignore */ }
        finally { setLoadingNotis(false); }
    };

    const marcarLeida = async (id) => {
        try {
            await api.patch(`/api/notificaciones/${id}/leida`);
            setNotis((prev) => prev.map(n => n.id === id ? { ...n, leida: true } : n));
        } catch { /* ignore */ }
    };

    // Actualizar fin de semana al cambiar inicio
    useEffect(() => {
        const start = new Date(weekStart);
        const sunday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
        setWeekEnd(sunday.toISOString().slice(0, 10));
    }, [weekStart]);

    // Cargar notificaciones al cambiar rol (solo CEO)
    useEffect(() => { fetchNotis(); /* eslint-disable-next-line */ }, [user?.rol]);

    // Auto-refresh notificaciones cada 60s (solo CEO)
    useEffect(() => {
        if (user?.rol !== 'ceo') return;
        const id = setInterval(() => { fetchNotis(); }, 60000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.rol]);

    const fetchSemana = async () => {
        setLoading(true); setError('');
        try {
            const { data } = await api.get(`/api/viajes?limit=100&from=${weekStart}&to=${weekEnd}&order=DESC&sortBy=fecha`);
            setViajes(data.data || data.items || []);
        } catch (e) {
            setError(e?.response?.data?.error || 'Error cargando viajes de la semana');
        } finally { setLoading(false); }
    };

    // Carga automática al cambiar el rango de semana
    useEffect(() => { fetchSemana(); /* eslint-disable-next-line */ }, [weekStart, weekEnd]);

    // Filtros, orden y paginación
    const [term, setTerm] = useState('');
    const [sort, setSort] = useState({ key: 'fecha', dir: 'DESC' });
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const viajesSoloFinalizados = useMemo(() => (viajes || []).filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajes]);
    // Filtros avanzados
    const [fEstado, setFEstado] = useState('todos'); // estado de factura
    const [fCliente, setFCliente] = useState('todos');
    const opcionesEstadoFactura = useMemo(() => {
        const set = new Set();
        (viajesSoloFinalizados || []).forEach(v => set.add((v.facturaEstado || 'pendiente').toLowerCase()));
        return ['todos', ...Array.from(set)];
    }, [viajesSoloFinalizados]);
    const opcionesCliente = useMemo(() => {
        const set = new Set();
        (viajesSoloFinalizados || []).forEach(v => { if (v.cliente) set.add(v.cliente); });
        return ['todos', ...Array.from(set)];
    }, [viajesSoloFinalizados]);

    const viajesFiltrados = useMemo(() => {
        const t = term.trim().toLowerCase();
        const list = (viajesSoloFinalizados || []).filter(v => (
            `${v.origen || ''} ${v.destino || ''} ${v.tipoMercaderia || ''} ${v.cliente || ''} ${v.camion?.patente || v.camionId || ''} ${v.camionero?.nombre || v.camioneroNombre || ''}`
                .toLowerCase().includes(t)
        ));
        return list
            .filter(v => (fEstado === 'todos' ? true : (v.facturaEstado || 'pendiente').toLowerCase() === fEstado))
            .filter(v => (fCliente === 'todos' ? true : (v.cliente || '') === fCliente));
    }, [viajesSoloFinalizados, term, fEstado, fCliente]);

    const viajesOrdenados = useMemo(() => {
        const arr = [...viajesFiltrados];
        const dir = (sort.dir || 'ASC').toUpperCase() === 'ASC' ? 1 : -1;
        const getVal = (v, k) => {
            switch (k) {
                case 'fecha': return new Date(v.fecha || 0).getTime();
                case 'estado': return (v.estado || '').toLowerCase();
                case 'origen': return (v.origen || '').toLowerCase();
                case 'destino': return (v.destino || '').toLowerCase();
                case 'camion': return (v.camion?.patente || v.camionId || '').toString().toLowerCase();
                case 'camionero': return (v.camionero?.nombre || v.camioneroNombre || '').toLowerCase();
                case 'tipo': return (v.tipoMercaderia || '').toLowerCase();
                case 'cliente': return (v.cliente || '').toLowerCase();
                case 'FacturaEstado': return (v.facturaEstado || '').toLowerCase();
                case 'FechaFactura': return new Date(v.fechaFactura || 0).getTime();
                case 'remitos': {
                    try { return (JSON.parse(v.remitosJson || '[]') || []).length } catch { return 0 }
                }
                default: return 0;
            }
        };
        arr.sort((a, b) => {
            const va = getVal(a, sort.key);
            const vb = getVal(b, sort.key);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        return arr;
    }, [viajesFiltrados, sort]);

    const totalPages = Math.max(1, Math.ceil(viajesOrdenados.length / pageSize));
    const curPage = Math.min(page, totalPages);
    const viajesPagina = useMemo(() => {
        const start = (curPage - 1) * pageSize;
        return viajesOrdenados.slice(start, start + pageSize);
    }, [viajesOrdenados, curPage]);

    // Modal de remitos
    const [remitosModal, setRemitosModal] = useState({ open: false, files: [], id: null });
    const [remitoPreviewUrl, setRemitoPreviewUrl] = useState('');
    const [dense, setDense] = useState(false);
    const [rowActionsOpen, setRowActionsOpen] = useState(null);
    const openRemitos = (v) => {
        let files = [];
        try { files = JSON.parse(v.remitosJson || '[]') || []; } catch { files = []; }
        setRemitosModal({ open: true, files, id: v.id });
        setRemitoPreviewUrl('');
        // Si Bootstrap está disponible, intenta usarlo; de lo contrario, usamos el render controlado por estado
        setTimeout(() => {
            try {
                const el = document.getElementById('modalRemitos');
                if (el && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(el).show();
            } catch { }
        }, 0);
    };
    const closeRemitos = () => {
        try {
            const el = document.getElementById('modalRemitos');
            if (el && window.bootstrap?.Modal) window.bootstrap.Modal.getOrCreateInstance(el).hide();
        } catch { }
        setRemitosModal({ open: false, files: [], id: null });
        setRemitoPreviewUrl('');
    };

    // Stats superiores
    const stats = useMemo(() => {
        const total = viajesSoloFinalizados.length;
        const cobradas = viajesSoloFinalizados.filter(v => (v.facturaEstado || '').toLowerCase() === 'cobrada').length;
        const conFactura = viajesSoloFinalizados.filter(v => !!v.facturaUrl).length;
        const sinRemitos = viajesSoloFinalizados.filter(v => {
            try { return (JSON.parse(v.remitosJson || '[]') || []).length === 0 } catch { return true }
        }).length;
        return { total, cobradas, conFactura, sinRemitos };
    }, [viajesSoloFinalizados]);

    const exportCSV = () => {
        const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Camionero', 'Tipo', 'Cliente', 'Factura', 'Factura Estado', 'Fecha Factura', 'Remitos'];
        const rows = (viajesOrdenados || []).map(v => [
            new Date(v.fecha).toLocaleDateString(),
            v.estado || '',
            v.origen || '',
            v.destino || '',
            v.camion?.patente || v.camionId || '',
            v.camionero?.nombre || v.camioneroNombre || '',
            v.tipoMercaderia || '',
            v.cliente || '',
            v.facturaUrl ? new URL(v.facturaUrl, api.defaults.baseURL).toString() : '-',
            v.facturaEstado || '-',
            v.fechaFactura ? new Date(v.fechaFactura).toLocaleDateString() : '-',
            (() => { try { return (JSON.parse(v.remitosJson || '[]') || []).length } catch { return 0 } })()
        ]);
        downloadCSV(`viajes_semana_${weekStart}_a_${weekEnd}.csv`, headers, rows);
    };

    const [uploading, setUploading] = useState(false);
    const subirFactura = async (id, file, estado, fechaFactura) => {
        if (!file) return;
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            if (estado) fd.append('FacturaEstado', estado);
            if (fechaFactura) fd.append('FechaFactura', fechaFactura);
            await api.post(`/api/viajes/${id}/factura`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            await fetchSemana();
        } finally { setUploading(false); }
    };
    const subirRemitos = async (id, files) => {
        if (!files?.length) return;
        setUploading(true);
        try {
            const fd = new FormData();
            Array.from(files).forEach(f => fd.append('files', f));
            await api.post(`/api/viajes/${id}/remitos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            await fetchSemana();
        } finally { setUploading(false); }
    };

    return (
        <div className="container py-3">
            <PageHeader
                title="Panel Administración"
                subtitle="Viajes por semana y gestión de facturación"
                actions={(
                    <div className="d-flex align-items-center gap-2">
                        {loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                        {user?.rol === 'ceo' && (
                            <div className="position-relative">
                                <button className={`btn btn-outline-secondary position-relative ${bellPulse ? 'notif-pulse' : ''}`} onClick={() => { setNotisOpen(v => !v); if (!notisOpen) fetchNotis(); }}>
                                    <i className="bi bi-bell"></i>
                                    {unreadCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unreadCount}</span>}
                                </button>
                                {notisOpen && (
                                    <div className="card position-absolute end-0 mt-2 shadow" style={{ minWidth: 360, zIndex: 1000 }}>
                                        <div className="card-header d-flex justify-content-between align-items-center py-2">
                                            <strong>Notificaciones</strong>
                                            <button className="btn btn-sm btn-light" onClick={fetchNotis}>{loadingNotis ? '...' : 'Refrescar'}</button>
                                        </div>
                                        <div className="list-group list-group-flush" style={{ maxHeight: 360, overflowY: 'auto' }}>
                                            {(notis || []).length === 0 ? (
                                                <div className="text-center text-body-secondary p-3">Sin notificaciones</div>
                                            ) : (
                                                (notis || []).map(n => (
                                                    <div key={n.id} className={`list-group-item d-flex justify-content-between align-items-start ${n.leida ? '' : 'bg-warning-subtle'}`}>
                                                        <div className="me-2">
                                                            <div className="fw-semibold">{n.tipo}</div>
                                                            <div className="small">{n.mensaje}</div>
                                                            <div className="text-body-secondary small">{new Date(n.fecha).toLocaleString()}</div>
                                                        </div>
                                                        {!n.leida && (
                                                            <button className="btn btn-sm btn-outline-primary" onClick={() => marcarLeida(n.id)}>Marcar leída</button>
                                                        )}
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            />

            <div className="card shadow-sm mb-3 card-hover">
                <div className="card-body d-flex flex-wrap align-items-end gap-2">
                    <div>
                        <label className="form-label mb-1">Semana (inicio)</label>
                        <input type="date" className="form-control" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
                    </div>
                    <div>
                        <label className="form-label mb-1">Semana (fin)</label>
                        <input type="date" className="form-control" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} />
                    </div>
                    <div className="d-flex gap-2">
                        <button className="btn btn-outline-secondary" title="Semana anterior" onClick={() => {
                            const start = new Date(weekStart); const end = new Date(weekEnd);
                            start.setDate(start.getDate() - 7); end.setDate(end.getDate() - 7);
                            setWeekStart(start.toISOString().slice(0, 10)); setWeekEnd(end.toISOString().slice(0, 10));
                        }}>
                            <i className="bi bi-chevron-left"></i>
                        </button>
                        <button className="btn btn-outline-secondary" title="Semana siguiente" onClick={() => {
                            const start = new Date(weekStart); const end = new Date(weekEnd);
                            start.setDate(start.getDate() + 7); end.setDate(end.getDate() + 7);
                            setWeekStart(start.toISOString().slice(0, 10)); setWeekEnd(end.toISOString().slice(0, 10));
                        }}>
                            <i className="bi bi-chevron-right"></i>
                        </button>
                    </div>
                    <button className="btn btn-soft-secondary btn-action" onClick={exportCSV} title="Exportar CSV"><i className="bi bi-filetype-csv me-1"></i> Exportar</button>
                    <button className="btn btn-soft-warning btn-action" onClick={async () => { try { await api.post('/api/viajes/checkVencidas'); } catch { } finally { fetchSemana(); fetchNotis(); } }} title="Generar notificaciones por facturas vencidas">Revisar vencidas</button>
                    <div className="ms-auto flex-grow-1" style={{ minWidth: 260, maxWidth: 420 }}>
                        <label className="form-label mb-1">Buscar</label>
                        <input className="form-control" placeholder="Origen, destino, tipo, cliente, camión o camionero" value={term} onChange={e => { setTerm(e.target.value); setPage(1); }} />
                    </div>
                    <div>
                        <label className="form-label mb-1">Estado factura</label>
                        <select className="form-select" value={fEstado} onChange={e => { setFEstado(e.target.value); setPage(1); }}>
                            {opcionesEstadoFactura.map(opt => (
                                <option key={opt} value={opt}>{opt === 'todos' ? 'Todos' : (opt.charAt(0).toUpperCase() + opt.slice(1))}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="form-label mb-1">Cliente</label>
                        <select className="form-select" value={fCliente} onChange={e => { setFCliente(e.target.value); setPage(1); }}>
                            {opcionesCliente.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-check form-switch d-flex align-items-center gap-2 ms-2">
                        <input className="form-check-input" type="checkbox" role="switch" id="switchDensityAdm" checked={dense} onChange={e => setDense(e.target.checked)} />
                        <label className="form-check-label" htmlFor="switchDensityAdm">Compacto</label>
                    </div>
                </div>
            </div>

            <div className="row g-3 mb-3">
                <div className="col-12 col-sm-6 col-lg-3">
                    <StatCard icon={<i className="bi bi-truck"></i>} label="Viajes finalizados" value={stats.total} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <StatCard icon={<i className="bi bi-receipt"></i>} label="Facturas subidas" value={stats.conFactura} hint={`${stats.total - stats.conFactura} sin factura`} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <StatCard icon={<i className="bi bi-cash-coin"></i>} label="Cobradas" value={stats.cobradas} hint={`${stats.total - stats.cobradas} pendientes`} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <StatCard icon={<i className="bi bi-files"></i>} label="Viajes sin remitos" value={stats.sinRemitos} />
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}

            <div className="card shadow-sm">
                <div className="card-body">
                    {viajesFiltrados.length === 0 ? (
                        <EmptyState title="Sin viajes" description="No hay viajes en la semana seleccionada" />
                    ) : (
                        <div className="table-responsive table-scroll">
                            <table className={`table ${dense ? 'table-sm table-compact' : ''} table-striped table-hover align-middle table-sticky`}>
                                <thead>
                                    <tr>
                                        {[
                                            ['fecha', 'Fecha'],
                                            ['estado', 'Estado'],
                                            ['origen', 'Origen'],
                                            ['destino', 'Destino'],
                                            ['camion', 'Camión'],
                                            ['camionero', 'Camionero'],
                                            ['tipo', 'Tipo'],
                                            ['cliente', 'Cliente'],
                                            ['factura', 'Factura'],
                                            ['FacturaEstado', 'Estado factura'],
                                            ['FechaFactura', 'Fecha factura'],
                                            ['remitos', 'Remitos'],
                                        ].map(([k, label]) => (
                                            <th key={k} role="button" onClick={() => setSort(s => ({ key: k, dir: s.key === k && s.dir === 'ASC' ? 'DESC' : 'ASC' }))}>
                                                <span className="me-1">{label}</span>
                                                {sort.key === k ? (
                                                    <i className={`bi ${sort.dir === 'ASC' ? 'bi-sort-up' : 'bi-sort-down'}`}></i>
                                                ) : (
                                                    <i className="bi bi-arrow-down-up opacity-50"></i>
                                                )}
                                            </th>
                                        ))}
                                        <th className="text-end">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viajesPagina.map(v => {
                                        const dias = (() => {
                                            const base = v.fechaFactura || v.fecha;
                                            if (!base) return 0;
                                            return Math.floor((Date.now() - new Date(base).getTime()) / (1000 * 60 * 60 * 24));
                                        })();
                                        const vencida = (v.facturaEstado || 'pendiente') !== 'cobrada' && dias > 30;
                                        const remitos = (() => { try { return JSON.parse(v.remitosJson || '[]') } catch { return [] } })();
                                        return (
                                            <tr key={v.id} className={vencida ? 'table-warning' : ''}>
                                                <td>{new Date(v.fecha).toLocaleDateString()}</td>
                                                <td><span className={`badge badge-dot ${v.estado === 'finalizado' ? 'badge-estado-finalizado' : v.estado === 'en curso' ? 'badge-estado-en_curso' : 'badge-estado-pendiente'} text-capitalize`}>{v.estado}</span></td>
                                                <td>{v.origen}</td>
                                                <td>{v.destino}</td>
                                                <td>{v.camion?.patente || v.camionId}</td>
                                                <td>{v.camionero?.nombre || v.camioneroNombre || '-'}</td>
                                                <td>{v.tipoMercaderia || '-'}</td>
                                                <td>{v.cliente || '-'}</td>
                                                <td>{v.facturaUrl ? <a href={buildUrl(v.facturaUrl)} target="_blank" rel="noreferrer">Ver</a> : '-'}</td>
                                                <td>
                                                    {(() => {
                                                        const st = (v.facturaEstado || 'pendiente').toLowerCase();
                                                        const map = {
                                                            'cobrada': 'badge-factura-cobrada',
                                                            'pendiente': 'badge-factura-pendiente',
                                                            'no cobrada': 'badge-factura-nocobrada',
                                                            'vencida': 'badge-factura-vencida'
                                                        };
                                                        const cls = map[st] || 'badge-factura-pendiente';
                                                        const label = st.charAt(0).toUpperCase() + st.slice(1);
                                                        return <span className={`badge ${cls}`}>{label}</span>;
                                                    })()}
                                                </td>
                                                <td>{v.fechaFactura ? new Date(v.fechaFactura).toLocaleDateString() : '-'}</td>
                                                <td>
                                                    <button className="btn btn-link p-0" onClick={() => openRemitos(v)} title="Ver remitos">{remitos.length}</button>
                                                </td>
                                                <td className="text-end">
                                                    {/* Desktop: acciones visibles */}
                                                    <div className="d-none d-md-flex flex-wrap gap-2 justify-content-end">
                                                        <label className="btn btn-sm btn-soft-primary btn-action mb-0 d-inline-flex align-items-center gap-1" title="Subir factura">
                                                            <i className="bi bi-receipt"></i>
                                                            <span>Subir factura</span>
                                                            <input type="file" className="d-none" onChange={e => subirFactura(v.id, e.target.files?.[0], v.facturaEstado, v.fechaFactura?.slice?.(0, 10))} />
                                                        </label>
                                                        <label className="btn btn-sm btn-soft-info btn-action mb-0 d-inline-flex align-items-center gap-1" title="Subir remitos">
                                                            <i className="bi bi-files"></i>
                                                            <span>Subir remitos</span>
                                                            <input type="file" className="d-none" multiple onChange={e => subirRemitos(v.id, e.target.files)} />
                                                        </label>
                                                        <div className="d-inline-flex align-items-center gap-1">
                                                            <select className="form-select form-select-sm" value={v.facturaEstado || 'pendiente'} onChange={async (e) => { await api.patch(`/api/viajes/${v.id}/factura`, { facturaEstado: e.target.value }); fetchSemana(); }}>
                                                                <option value="pendiente">Pendiente</option>
                                                                <option value="cobrada">Cobrada</option>
                                                                <option value="no cobrada">No cobrada</option>
                                                                <option value="vencida">Vencida</option>
                                                            </select>
                                                        </div>
                                                        <input className="form-control form-control-sm" type="date" value={v.fechaFactura ? new Date(v.fechaFactura).toISOString().slice(0, 10) : ''} onChange={async (e) => { await api.patch(`/api/viajes/${v.id}/factura`, { fechaFactura: e.target.value }); fetchSemana(); }} style={{ maxWidth: 160 }} />
                                                    </div>
                                                    {/* Mobile: botón que despliega panel */}
                                                    <div className="d-flex d-md-none justify-content-end position-relative mt-1">
                                                        <button className="btn btn-sm btn-outline-secondary btn-action d-inline-flex align-items-center gap-1" onClick={() => setRowActionsOpen(prev => prev === v.id ? null : v.id)}>
                                                            <i className="bi bi-three-dots"></i> Acciones
                                                        </button>
                                                        {rowActionsOpen === v.id && (
                                                            <div className="card shadow position-absolute end-0 mt-2" style={{ zIndex: 100, minWidth: 240 }} onMouseLeave={() => setRowActionsOpen(null)}>
                                                                <div className="card-body d-flex flex-column gap-2">
                                                                    <label className="btn btn-sm btn-soft-primary btn-action mb-0 d-inline-flex align-items-center gap-1" title="Subir factura">
                                                                        <i className="bi bi-receipt"></i>
                                                                        <span>Subir factura</span>
                                                                        <input type="file" className="d-none" onChange={e => { subirFactura(v.id, e.target.files?.[0], v.facturaEstado, v.fechaFactura?.slice?.(0, 10)); setRowActionsOpen(null); }} />
                                                                    </label>
                                                                    <label className="btn btn-sm btn-soft-info btn-action mb-0 d-inline-flex align-items-center gap-1" title="Subir remitos">
                                                                        <i className="bi bi-files"></i>
                                                                        <span>Subir remitos</span>
                                                                        <input type="file" className="d-none" multiple onChange={e => { subirRemitos(v.id, e.target.files); setRowActionsOpen(null); }} />
                                                                    </label>
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <select className="form-select form-select-sm" value={v.facturaEstado || 'pendiente'} onChange={async (e) => { await api.patch(`/api/viajes/${v.id}/factura`, { facturaEstado: e.target.value }); fetchSemana(); }}>
                                                                            <option value="pendiente">Pendiente</option>
                                                                            <option value="cobrada">Cobrada</option>
                                                                            <option value="no cobrada">No cobrada</option>
                                                                        </select>
                                                                        <input className="form-control form-control-sm" type="date" value={v.fechaFactura ? new Date(v.fechaFactura).toISOString().slice(0, 10) : ''} onChange={async (e) => { await api.patch(`/api/viajes/${v.id}/factura`, { fechaFactura: e.target.value }); fetchSemana(); }} />
                                                                    </div>
                                                                    <button className="btn btn-sm btn-light" onClick={() => setRowActionsOpen(null)}>Cerrar</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="d-flex justify-content-between align-items-center mt-2">
                                <small className="text-body-secondary">Mostrando {(viajesPagina.length && (curPage - 1) * pageSize + 1) || 0} - {(curPage - 1) * pageSize + viajesPagina.length} de {viajesOrdenados.length}</small>
                                <div className="btn-group" role="group">
                                    <button className="btn btn-outline-secondary btn-sm" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                                    <button className="btn btn-outline-secondary btn-sm" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal Remitos (funciona con o sin Bootstrap JS) */}
            <div className={`modal ${remitosModal.open ? 'd-block show' : 'fade'}`} id="modalRemitos" tabIndex="-1" aria-hidden={!remitosModal.open} style={remitosModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog modal-dialog-scrollable">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Remitos del viaje #{remitosModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={closeRemitos}></button>
                        </div>
                        <div className="modal-body">
                            {remitosModal.files.length === 0 ? (
                                <div className="text-body-secondary">Sin remitos cargados</div>
                            ) : (
                                <>
                                    <ul className="list-group list-group-flush mb-3">
                                        {remitosModal.files.map((url, idx) => {
                                            const full = buildUrl(url);
                                            const img = isImageUrl(url);
                                            const pdf = isPdfUrl(url);
                                            return (
                                                <li key={idx} className="list-group-item d-flex align-items-center justify-content-between gap-2">
                                                    <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                                        {img ? (
                                                            <img src={full} alt={`remito-${idx}`} className="img-thumbnail" style={{ maxWidth: 80, maxHeight: 60, objectFit: 'cover' }} onClick={() => setRemitoPreviewUrl(full)} title="Previsualizar" />
                                                        ) : pdf ? (
                                                            <span className="badge bg-secondary"><i className="bi bi-file-pdf me-1"></i>PDF</span>
                                                        ) : (
                                                            <span className="badge bg-light text-dark"><i className="bi bi-file-earmark-text me-1"></i>Archivo</span>
                                                        )}
                                                        <span className="text-truncate" title={full} style={{ maxWidth: 240 }}>{full}</span>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-2">
                                                        {(img || pdf) && (
                                                            <button className="btn btn-sm btn-outline-primary" onClick={() => setRemitoPreviewUrl(full)}>Previsualizar</button>
                                                        )}
                                                        <a className="btn btn-sm btn-outline-secondary" href={full} target="_blank" rel="noreferrer">Abrir</a>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {remitoPreviewUrl && (
                                        <div className="card">
                                            <div className="card-header d-flex justify-content-between align-items-center py-2">
                                                <strong>Vista previa</strong>
                                                <button className="btn btn-sm btn-light" onClick={() => setRemitoPreviewUrl('')}>Cerrar</button>
                                            </div>
                                            <div className="card-body" style={{ maxHeight: '65vh', overflow: 'auto' }}>
                                                {isImageUrl(remitoPreviewUrl) ? (
                                                    <img src={remitoPreviewUrl} alt="preview-remito" style={{ maxWidth: '100%' }} />
                                                ) : isPdfUrl(remitoPreviewUrl) ? (
                                                    <iframe title="preview-remito" src={remitoPreviewUrl} style={{ width: '100%', height: '65vh', border: 'none' }} />
                                                ) : (
                                                    <div className="text-body-secondary">Tipo de archivo no compatible para previsualización.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={closeRemitos}>Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PageHeader from '../components/UI/PageHeader';
import StatCard from '../components/UI/StatCard';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
// Migración de exportación: reemplazamos CSV por PDF y añadimos detalle/factura
import { generarListadoViajesPDF, generarDetalleViajePDF, generarFacturaViajePDF } from '../utils/pdf';
import { SkeletonText } from '../components/UI/Skeleton';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../context/ToastContext';
import DashboardCharts from '../components/UI/DashboardCharts';

export default function Administracion() {

    // Estados base
    const { user } = useAuth();
    const { showToast } = useToast();
    const [viajes, setViajes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const isImageUrl = (url) => /(\.(png|jpg|jpeg|gif|bmp|webp))$/i.test(url || '');
    const isPdfUrl = (url) => /(\.(pdf))$/i.test(url || '');
    const [fEstado, setFEstado] = useState('todos');
    const [rowActionsOpen, setRowActionsOpen] = useState(null);
    const [rowMenuPos, setRowMenuPos] = useState({ top: 0, right: 0 });
    const [remitosModal, setRemitosModal] = useState({ open: false, id: null, files: [] });
    const [remitoPreviewUrl, setRemitoPreviewUrl] = useState('');
    // ...existing code...

    // Funciones para remitos
    const openRemitos = (v) => {
        let files = [];
        try { files = JSON.parse(v.remitosJson || '[]'); } catch { files = []; }
        setRemitosModal({ open: true, id: v.id, files });
        setRemitoPreviewUrl('');
    };
    const closeRemitos = () => setRemitosModal({ open: false, id: null, files: [] });
    const [facturaModal, setFacturaModal] = useState({ open: false, id: null, estado: 'pendiente', fecha: '', precioUnitario: '', conIVA: false, file: null, loading: false, error: '' });
    const openFactura = (v) => {
        const yyyyMMdd = (d) => {
            if (!d) return '';
            const dt = new Date(d);
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const dd = String(dt.getDate()).padStart(2, '0');
            return `${dt.getFullYear()}-${mm}-${dd}`;
        };
        setFacturaModal({
            open: true,
            id: v.id,
            estado: (v.facturaEstado || 'pendiente').toLowerCase(),
            fecha: yyyyMMdd(v.fechaFactura || v.fecha),
            precioUnitario: v.importe ?? '',
            conIVA: false,
            file: null,
            loading: false,
            error: ''
        });
    };
    const closeFactura = () => setFacturaModal({ open: false, id: null, estado: 'pendiente', fecha: '', precioUnitario: '', conIVA: false, file: null, loading: false, error: '' });
    const submitFactura = async () => {
        if (!facturaModal.id) return;
        setFacturaModal((m) => ({ ...m, loading: true, error: '' }));
        try {
            // Si hay archivo, POST multipart; si no, PATCH solo estado/fecha
            if (facturaModal.file) {
                const fd = new FormData();
                fd.append('file', facturaModal.file);
                if (facturaModal.estado) fd.append('facturaEstado', facturaModal.estado);
                if (facturaModal.fecha) fd.append('fechaFactura', facturaModal.fecha);
                if (String(facturaModal.precioUnitario).trim() !== '') fd.append('precioUnitario', String(facturaModal.precioUnitario));
                fd.append('conIVA', facturaModal.conIVA ? 'true' : 'false');
                await api.post(`/viajes/${facturaModal.id}/factura`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                await api.patch(`/viajes/${facturaModal.id}/factura`, {
                    facturaEstado: facturaModal.estado,
                    fechaFactura: facturaModal.fecha || null,
                    precioUnitario: String(facturaModal.precioUnitario || '').trim() !== '' ? Number(facturaModal.precioUnitario) : undefined,
                    conIVA: facturaModal.conIVA,
                });
            }
            showToast('Factura actualizada', 'success');
            closeFactura();
            fetchSemana();
        } catch (e) {
            setFacturaModal((m) => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error al subir/actualizar factura' }));
        }
    };
    const [remitosUploadModal, setRemitosUploadModal] = useState({ open: false, id: null, files: [], loading: false, error: '' });
    const openUploadRemitos = (v) => setRemitosUploadModal({ open: true, id: v.id, files: [], loading: false, error: '' });
    const closeUploadRemitos = () => setRemitosUploadModal({ open: false, id: null, files: [], loading: false, error: '' });
    const submitUploadRemitos = async () => {
        if (!remitosUploadModal.id || !(remitosUploadModal.files?.length)) return;
        setRemitosUploadModal(m => ({ ...m, loading: true, error: '' }));
        try {
            const fd = new FormData();
            remitosUploadModal.files.forEach(f => fd.append('files', f));
            await api.post(`/viajes/${remitosUploadModal.id}/remitos`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            showToast('Remitos subidos', 'success');
            closeUploadRemitos();
            fetchSemana();
        } catch (e) {
            setRemitosUploadModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error al subir remitos' }));
        }
    };

    // ...existing code...
    // Estado para modo compacto de la tabla
    const [dense, setDense] = useState(false);
    // Función para exportar el listado de viajes a PDF
    // Helpers fecha (DATEONLY)
    const formatDateOnly = (s) => {
        if (!s) return '-';
        try { const [y, m, d] = String(s).split('-').map(Number); const dt = new Date(y, (m || 1) - 1, d || 1); return dt.toLocaleDateString(); } catch { return s; }
    };

    const exportPDF = () => {
        try {
            const titulo = `Listado de viajes finalizados (${weekStart} a ${weekEnd})`;
            const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Camionero', 'Tipo', 'Cliente', 'Kilos', 'Precio/Tn', 'Importe', 'Factura', 'Estado factura', 'Fecha factura', 'Remitos'];
            const rows = (viajesFiltrados || []).map(v => [
                formatDateOnly(v.fecha),
                v.estado || '-',
                v.origen || '-',
                v.destino || '-',
                v.camion?.patente || v.camionId || '-',
                v.camionero?.nombre || v.camioneroNombre || '-',
                v.tipoMercaderia || '-',
                v.cliente || '-',
                v.kilosCargados ?? '-',
                v.precioTonelada ?? '-',
                v.importe ?? '-',
                v.facturaUrl ? 'Sí' : 'No',
                v.facturaEstado || '-',
                v.fechaFactura ? formatDateOnly(v.fechaFactura) : '-',
                (() => { try { return (JSON.parse(v.remitosJson || '[]') || []).length } catch { return 0 } })(),
            ]);
            generarListadoViajesPDF(titulo, headers, rows, 'viajes.pdf');
        } catch (e) {
            showToast('Error al exportar PDF', 'error');
        }
    };

    // Handlers PDF por fila
    const descargarDetallePDF = (v) => {
        try { generarDetalleViajePDF(v); showToast('Detalle PDF generado', 'success'); } catch { showToast('Error generando detalle PDF', 'error'); }
    };
    const descargarFacturaPDF = (v) => {
        // Validar que tenga datos fundamentales
        if (!v || v.estado?.toLowerCase() !== 'finalizado') {
            showToast('El viaje debe estar finalizado', 'warning');
            return;
        }
        try { generarFacturaViajePDF(v); showToast('Factura PDF generada', 'success'); } catch { showToast('Error generando factura PDF', 'error'); }
    };
    const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null, onCancel: null });
    const buildUrl = (u) => {
        try {
            const base = api?.defaults?.baseURL || window.location.origin;
            return new URL(u, base).toString();
        } catch { return u || '#'; }
    };
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

    // Modal IA (resumen)
    const [iaModal, setIaModal] = useState({ open: false, text: '', loading: false, error: '' });
    const openIa = () => setIaModal(m => ({ ...m, open: true }));
    const closeIa = () => setIaModal({ open: false, text: '', loading: false, error: '' });
    const resumirSemana = async () => {
        setIaModal({ open: true, text: '', loading: true, error: '' });
        try {
            const { data } = await api.post('/ia/resumen/periodo', { from: weekStart, to: weekEnd });
            const txt = data?.output || data?.raw || JSON.stringify(data, null, 2);
            setIaModal({ open: true, text: txt, loading: false, error: '' });
        } catch (e) {
            setIaModal({ open: true, text: '', loading: false, error: e?.response?.data?.error || 'Error al generar resumen' });
        }
    };

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
            const { data } = await api.get('/notificaciones');
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
            await api.patch(`/notificaciones/${id}/leida`);
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

    // (Se mueve la inicialización de tooltips más abajo, luego de calcular las páginas para evitar TDZ)

    const fetchSemana = async () => {
        setLoading(true); setError('');
        try {
            const { data } = await api.get(`/viajes?limit=100&from=${weekStart}&to=${weekEnd}&order=DESC&sortBy=fecha`);
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

    // Accesibilidad: fila seleccionada para atajos
    const [selectedRowId, setSelectedRowId] = useState(null);
    const selectNextPrev = (dir) => {
        const ids = viajesPagina.map(v => v.id);
        if (!ids.length) return;
        if (selectedRowId == null || !ids.includes(selectedRowId)) {
            setSelectedRowId(ids[0]);
            return;
        }
        const idx = ids.indexOf(selectedRowId);
        const nextIdx = Math.min(Math.max(idx + dir, 0), ids.length - 1);
        setSelectedRowId(ids[nextIdx]);
    };



    const viajesSoloFinalizados = useMemo(() => (viajes || []).filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajes]);
    // Estadísticas para las cards (debe ir después de viajesSoloFinalizados)
    const stats = useMemo(() => {
        const total = viajesSoloFinalizados.length;
        const conFactura = viajesSoloFinalizados.filter(v => v.facturaUrl).length;
        const cobradas = viajesSoloFinalizados.filter(v => (v.facturaEstado || '').toLowerCase() === 'cobrada').length;
        const sinRemitos = viajesSoloFinalizados.filter(v => !v.remitosJson || v.remitosJson === '[]').length;
        return { total, conFactura, cobradas, sinRemitos };
    }, [viajesSoloFinalizados]);
    // Filtros avanzados
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

    // Derivados (definidos después de viajesFiltrados)
    const curPage = page;
    const totalPages = Math.ceil(viajesFiltrados.length / pageSize);
    const viajesPagina = useMemo(() => {
        const start = (curPage - 1) * pageSize;
        return viajesFiltrados.slice(start, start + pageSize);
    }, [viajesFiltrados, curPage, pageSize]);

    // Inicialización de tooltips de Bootstrap (por si hay elementos con data-bs-toggle="tooltip")
    // Ubicado después de calcular viajesPagina para evitar RefererenceError (TDZ)
    useEffect(() => {
        try {
            const els = Array.from(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
            const instances = els
                .map(el => window.bootstrap?.Tooltip ? window.bootstrap.Tooltip.getOrCreateInstance(el) : null)
                .filter(Boolean);
            return () => {
                instances.forEach(inst => {
                    try { inst.hide(); } catch { }
                    try { inst.dispose(); } catch { }
                });
            };
        } catch { }
    }, [viajesPagina, viajesFiltrados, term, fEstado, fCliente]);

    // Cerrar menú al hacer scroll o resize para evitar desalineación
    useEffect(() => {
        if (!rowActionsOpen) return;
        const handler = () => setRowActionsOpen(null);
        window.addEventListener('scroll', handler, true);
        window.addEventListener('resize', handler);
        return () => {
            window.removeEventListener('scroll', handler, true);
            window.removeEventListener('resize', handler);
        };
    }, [rowActionsOpen]);

    // Atajos de teclado (solo dentro de la vista Administración). Ubicado aquí para que las dependencias existan.
    useEffect(() => {
        const handler = (e) => {
            if (e.altKey) {
                switch (e.key.toLowerCase()) {
                    case 'l':
                        e.preventDefault();
                        exportPDF();
                        break;
                    case 'f':
                        e.preventDefault();
                        if (selectedRowId) {
                            const v = viajesPagina.find(v => v.id === selectedRowId);
                            if (v) openFactura(v);
                        }
                        break;
                    case 'r':
                        e.preventDefault();
                        if (selectedRowId) {
                            const v = viajesPagina.find(v => v.id === selectedRowId);
                            if (v) openUploadRemitos(v);
                        }
                        break;
                    case 'v':
                        e.preventDefault();
                        if (selectedRowId) {
                            const v = viajesPagina.find(v => v.id === selectedRowId);
                            if (v) openRemitos(v);
                        }
                        break;
                    case 'd':
                        e.preventDefault();
                        if (selectedRowId) {
                            const v = viajesPagina.find(v => v.id === selectedRowId);
                            if (v) descargarDetallePDF(v);
                        }
                        break;
                    case 'i':
                        e.preventDefault();
                        resumirSemana();
                        break;
                    case 'x':
                        e.preventDefault();
                        if (facturaModal.open) closeFactura();
                        if (remitosUploadModal.open) closeUploadRemitos();
                        if (remitosModal.open) closeRemitos();
                        if (iaModal.open) closeIa();
                        break;
                    default:
                        break;
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectNextPrev(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectNextPrev(-1);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [viajesPagina, selectedRowId, facturaModal.open, remitosUploadModal.open, remitosModal.open, iaModal.open]);


    return (
        <>
            <PageHeader title="Administración" subtitle={user?.nombre ? `Hola, ${user.nombre}` : undefined} showUserMenu={true} />
            {/* Mensaje de error */}
            {error && <div className="alert alert-danger">{error}</div>}
            {/* Filtros y acciones */}
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
                    <button className="btn btn-soft-danger btn-action" onClick={exportPDF} title="Exportar PDF"><i className="bi bi-filetype-pdf me-1"></i> PDF Viajes</button>
                    <button className="btn btn-soft-warning btn-action" onClick={async () => { try { await api.post('/viajes/checkVencidas'); } catch { } finally { fetchSemana(); fetchNotis(); } }} title="Generar notificaciones por facturas vencidas">Revisar vencidas</button>
                    {(user?.rol === 'ceo' || user?.rol === 'administracion') && (
                        <button className="btn btn-soft-primary btn-action" onClick={resumirSemana} title="Resumir la semana con IA">
                            <i className="bi bi-magic me-1"></i> Resumir semana
                        </button>
                    )}
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

            {/* Cards de estadísticas */}
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

            {/* Tabla de viajes */}
            <div className="card shadow-sm">
                <div className="card-body">
                    {viajesFiltrados.length === 0 ? (
                        <EmptyState title="Sin viajes" description="No hay viajes en la semana seleccionada" />
                    ) : (
                        <div className="table-responsive table-scroll">
                            <table className={`table ${dense ? 'table-sm table-compact' : ''} table-striped table-hover align-middle table-sticky table-cols-bordered`}>
                                <caption id="admTableCaption" className="visually-hidden">Listado de viajes finalizados de la semana seleccionada. Use Alt+L para PDF, Alt+F factura, Alt+R subir remitos, Alt+V ver remitos, Alt+D detalle PDF, Alt+I resumen IA, flechas para navegar filas.</caption>
                                <thead>
                                    <tr>
                                        <th scope="col">Fecha</th>
                                        <th scope="col">Estado</th>
                                        <th scope="col">Origen</th>
                                        <th scope="col">Destino</th>
                                        <th scope="col">Camión</th>
                                        <th scope="col">Camionero</th>
                                        <th scope="col">Tipo</th>
                                        <th scope="col">Cliente</th>
                                        <th scope="col">Kilos</th>
                                        <th scope="col">Precio/Tn</th>
                                        <th scope="col">Importe</th>
                                        <th scope="col">Acoplado</th>
                                        <th scope="col">Subtotal</th>
                                        <th scope="col">Factura</th>
                                        <th scope="col">Estado factura</th>
                                        <th scope="col">Fecha factura</th>
                                        <th scope="col">Remitos</th>
                                        <th className="text-end" style={{ position: 'sticky', right: 0, background: 'var(--bs-body-bg)' }}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {viajesPagina.map(v => {
                                        const remitos = (() => { try { return JSON.parse(v.remitosJson || '[]') } catch { return [] } })();
                                        const vencidaVisual = (v.facturaEstado || '').toLowerCase() === 'vencida';
                                        return (
                                            <tr
                                                key={v.id}
                                                className={`${(vencidaVisual) ? 'table-warning' : ''} ${selectedRowId === v.id ? 'table-active' : ''}`}
                                                tabIndex={0}
                                                role="row"
                                                aria-selected={selectedRowId === v.id}
                                                onClick={() => setSelectedRowId(v.id)}
                                                onDoubleClick={() => openFactura(v)}
                                            >
                                                <td>{formatDateOnly(v.fecha)}</td>
                                                <td><span className={`badge badge-dot ${v.estado === 'finalizado' ? 'badge-estado-finalizado' : v.estado === 'en curso' ? 'badge-estado-en_curso' : 'badge-estado-pendiente'} text-capitalize`}>{v.estado}</span></td>
                                                <td>{v.origen || '-'}</td>
                                                <td>{v.destino || '-'}</td>
                                                <td>{v.camion?.patente || v.camionId || '-'}</td>
                                                <td>{v.camionero?.nombre || v.camioneroNombre || '-'}</td>
                                                <td>{v.tipoMercaderia || '-'}</td>
                                                <td>{v.cliente || '-'}</td>
                                                <td>{v.kilosCargados ?? '-'}</td>
                                                <td>{v.precioTonelada ?? '-'}</td>
                                                <td>{v.importe ?? '-'}</td>
                                                <td>{v.acoplado?.patente || v.acopladoPatente || '-'}</td>
                                                <td>{v.importe ?? '-'}</td>
                                                <td>{v.facturaUrl ? <a href={buildUrl(v.facturaUrl)} target="_blank" rel="noreferrer" aria-label={`Abrir factura del viaje ${v.id}`}>Ver</a> : '-'}</td>
                                                <td>
                                                    {v.facturaEstado ? (
                                                        <span className={`badge text-capitalize ${(v.facturaEstado.toLowerCase() === 'cobrada') ? 'bg-success-subtle text-success' :
                                                            (v.facturaEstado.toLowerCase() === 'emitida') ? 'bg-info-subtle text-info' :
                                                                (v.facturaEstado.toLowerCase() === 'vencida') ? 'bg-warning-subtle text-warning' :
                                                                    'bg-secondary-subtle text-secondary'
                                                            }`}>
                                                            {v.facturaEstado}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td>{v.fechaFactura ? formatDateOnly(v.fechaFactura) : '-'}</td>
                                                <td>
                                                    <button className="btn btn-link p-0" onClick={() => openRemitos(v)} title="Ver remitos" aria-label={`Ver ${remitos.length} remitos del viaje ${v.id}`}>{remitos.length}</button>
                                                </td>
                                                <td className="text-end position-relative" style={{ position: 'sticky', right: 0, background: 'var(--bs-body-bg)' }}>
                                                    <button
                                                        className="btn btn-sm btn-outline-secondary"
                                                        title="Acciones"
                                                        aria-label={`Acciones del viaje ${v.id}`}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const next = (rowActionsOpen === v.id ? null : v.id);
                                                            setRowActionsOpen(next);
                                                            if (next) {
                                                                setRowMenuPos({ top: rect.bottom, right: window.innerWidth - rect.right });
                                                            }
                                                        }}
                                                    >
                                                        <i className="bi bi-three-dots"></i>
                                                    </button>
                                                    {rowActionsOpen === v.id && createPortal(
                                                        <div className="dropdown-menu show" style={{ position: 'fixed', top: rowMenuPos.top, right: rowMenuPos.right, zIndex: 1055 }}>
                                                            <button className="dropdown-item" onClick={() => { openFactura(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-receipt me-2"></i> Subir/Editar factura
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => { openUploadRemitos(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-files me-2"></i> Subir remitos
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => { descargarDetallePDF(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-file-earmark-text me-2"></i> Detalle PDF
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => { descargarFacturaPDF(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-file-earmark-pdf me-2"></i> Factura PDF
                                                            </button>
                                                        </div>, document.body
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="d-flex justify-content-between align-items-center mt-2">
                                <small className="text-body-secondary">Mostrando {(viajesPagina.length && (curPage - 1) * pageSize + 1) || 0} - {(curPage - 1) * pageSize + viajesPagina.length} de {viajesFiltrados.length}</small>
                                <div className="btn-group" role="group" aria-label="Paginación">
                                    <button className="btn btn-outline-secondary btn-sm" disabled={curPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                                    <button className="btn btn-outline-secondary btn-sm" disabled={curPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Gráficos (debajo de la tabla) */}
            <div className="row g-3 mt-3">
                <div className="col-12">
                    <DashboardCharts viajes={viajesSoloFinalizados} />
                </div>
            </div>

            {/* Modal: Factura */}
            <div className={`modal ${facturaModal.open ? 'd-block show' : 'fade'}`} id="modalFactura" tabIndex="-1" aria-hidden={!facturaModal.open} style={facturaModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Factura del viaje #{facturaModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeFactura}></button>
                        </div>
                        <div className="modal-body">
                            {facturaModal.error && <div className="alert alert-danger">{facturaModal.error}</div>}
                            <div className="mb-3">
                                <label className="form-label">Estado de factura</label>
                                <select className="form-select" value={facturaModal.estado} onChange={(e) => setFacturaModal(m => ({ ...m, estado: e.target.value }))}>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="emitida">Emitida</option>
                                    <option value="cobrada">Cobrada</option>
                                    <option value="vencida">Vencida</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Fecha de factura</label>
                                <input type="date" className="form-control" value={facturaModal.fecha} onChange={(e) => setFacturaModal(m => ({ ...m, fecha: e.target.value }))} />
                            </div>
                            <div className="row g-2 mb-3">
                                <div className="col-6">
                                    <label className="form-label">Precio Unitario</label>
                                    <input type="number" min={0} step={0.01} className="form-control" value={facturaModal.precioUnitario}
                                        onChange={(e) => setFacturaModal(m => ({ ...m, precioUnitario: e.target.value }))} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label d-block">IVA</label>
                                    <div className="form-check">
                                        <input className="form-check-input" type="checkbox" id="chkCargarConIVA" checked={facturaModal.conIVA}
                                            onChange={(e) => setFacturaModal(m => ({ ...m, conIVA: e.target.checked }))} />
                                        <label className="form-check-label" htmlFor="chkCargarConIVA">Aplicar IVA (21%)</label>
                                    </div>
                                    <div className="form-text">Si marcás IVA, el importe se calculará como precio × 1.21.</div>
                                </div>
                            </div>
                            <div className="mb-0">
                                <label className="form-label">Archivo (opcional)</label>
                                <input type="file" className="form-control" accept="image/*,.pdf" onChange={(e) => setFacturaModal(m => ({ ...m, file: e.target.files?.[0] || null }))} />
                                <div className="form-text">Si no subís archivo, se actualizará solo el estado/fecha.</div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeFactura} disabled={facturaModal.loading}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={submitFactura} disabled={facturaModal.loading}>
                                {facturaModal.loading ? <span className="spinner-border spinner-border-sm" role="status" /> : 'Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Subir Remitos */}
            <div className={`modal ${remitosUploadModal.open ? 'd-block show' : 'fade'}`} id="modalSubirRemitos" tabIndex="-1" aria-hidden={!remitosUploadModal.open} style={remitosUploadModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Subir remitos para viaje #{remitosUploadModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeUploadRemitos}></button>
                        </div>
                        <div className="modal-body">
                            {remitosUploadModal.error && <div className="alert alert-danger">{remitosUploadModal.error}</div>}
                            <div className="mb-3">
                                <label className="form-label">Archivos de remito</label>
                                <input type="file" className="form-control" multiple accept="image/*,.pdf" onChange={(e) => setRemitosUploadModal(m => ({ ...m, files: Array.from(e.target.files || []) }))} />
                                <div className="form-text">Podés subir varias imágenes o PDFs a la vez.</div>
                            </div>
                            {remitosUploadModal.files?.length > 0 && (
                                <ul className="list-group mb-0">
                                    {remitosUploadModal.files.map((f, i) => (
                                        <li key={i} className="list-group-item d-flex justify-content-between align-items-center">
                                            <span className="text-truncate" style={{ maxWidth: 320 }}>{f.name}</span>
                                            <span className="badge bg-secondary">{Math.ceil(f.size / 1024)} KB</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeUploadRemitos} disabled={remitosUploadModal.loading}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={submitUploadRemitos} disabled={remitosUploadModal.loading || !(remitosUploadModal.files?.length)}>
                                {remitosUploadModal.loading ? <span className="spinner-border spinner-border-sm" role="status" /> : 'Subir'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Ver Remitos */}
            <div className={`modal ${remitosModal.open ? 'd-block show' : 'fade'}`} id="modalRemitos" tabIndex="-1" aria-hidden={!remitosModal.open} style={remitosModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog modal-dialog-scrollable">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Remitos del viaje #{remitosModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeRemitos}></button>
                        </div>
                        <div className="modal-body">
                            {remitosModal.files.length === 0 ? (
                                <div className="text-body-secondary">Sin remitos cargados</div>
                            ) : (
                                <ul className="list-group list-group-flush mb-3">
                                    {remitosModal.files.map((url, idx) => {
                                        const full = buildUrl(url);
                                        const img = isImageUrl(url);
                                        const pdf = isPdfUrl(url);
                                        return (
                                            <li key={idx} className="list-group-item d-flex align-items-center justify-content-between gap-2">
                                                <div className="d-flex align-items-center gap-2" style={{ minWidth: 0 }}>
                                                    {img ? (
                                                        <img src={full} alt={`remito-${idx}`} className="img-thumbnail" style={{ maxWidth: 80, maxHeight: 60, objectFit: 'cover' }} title="Previsualizar" />
                                                    ) : pdf ? (
                                                        <span className="badge bg-secondary"><i className="bi bi-file-pdf me-1"></i>PDF</span>
                                                    ) : (
                                                        <span className="badge bg-light text-dark"><i className="bi bi-file-earmark-text me-1"></i>Archivo</span>
                                                    )}
                                                    <span className="text-truncate" title={full} style={{ maxWidth: 240 }}>{full}</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    <a className="btn btn-sm btn-outline-secondary" href={full} target="_blank" rel="noreferrer">Abrir</a>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeRemitos}>Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>

        </>
    );
}


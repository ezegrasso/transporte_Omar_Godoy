import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { generarListadoViajesPDF, generarDetalleViajePDF, generarFacturaViajePDF } from '../utils/pdf';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import React from 'react';
import DashboardCharts from '../components/UI/DashboardCharts';

function AcopladosCrud({ acoplados, onCreated, onUpdated, onDeleted }) {
    const [nuevo, setNuevo] = useState({ patente: '' });
    const [saving, setSaving] = useState(false);
    const [editId, setEditId] = useState(null);
    const [editData, setEditData] = useState({ patente: '' });
    const { showToast } = useToast();
    const [error, setError] = useState('');

    const normalizarPatente = (pat) => String(pat || '').toUpperCase().replace(/\s+/g, '').trim();
    const validarPatente = (pat) => {
        if (!pat) return 'La patente es requerida';
        const p = normalizarPatente(pat);
        const ok = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(p);
        return ok ? '' : 'Formato inválido (AAA123 o AB123CD)';
    };

    const crear = async (e) => {
        e.preventDefault();
        setError('');
        const p = String(nuevo.patente || '').toUpperCase().trim();
        const err = validarPatente(p);
        if (err) { showToast(err, 'error'); return; }
        setSaving(true);
        try {
            await api.post('/acoplados', { patente: normalizarPatente(p) });
            setNuevo({ patente: '' });
            onCreated && onCreated();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error creando acoplado';
            setError(msg);
            showToast(msg, 'error');
        } finally { setSaving(false); }
    };

    const saveEdit = async (id) => {
        setError('');
        const p = normalizarPatente(editData.patente);
        const err = validarPatente(p);
        if (err) { showToast(err, 'error'); return; }
        try {
            await api.patch(`/acoplados/${id}`, { patente: p });
            setEditId(null);
            onUpdated && onUpdated();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error actualizando acoplado';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    const eliminar = async (id) => {
        if (!confirm('¿Eliminar acoplado?')) return;
        try {
            await api.delete(`/acoplados/${id}`);
            onDeleted && onDeleted();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error eliminando acoplado';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    return (
        <div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}
            <form onSubmit={crear} className="row g-2 mt-2" style={{ opacity: saving ? 0.85 : 1 }}>
                <div className="col-6">
                    <input className="form-control" placeholder="Patente acoplado" value={nuevo.patente}
                        onChange={e => setNuevo(v => ({ ...v, patente: e.target.value.toUpperCase() }))} />
                </div>
                <div className="col-12"><button className="btn btn-primary" disabled={saving}>{saving ? 'Guardando…' : 'Crear acoplado'}</button></div>
            </form>
            <div className="table-responsive mt-3">
                {acoplados.length === 0 ? (
                    <EmptyState title="Sin acoplados" description="Todavía no cargaste acoplados" />
                ) : (
                    <table className={`table table-hover align-middle mb-0 table-sticky`}>
                        <thead>
                            <tr>
                                <th>Patente</th>
                                <th className="text-end">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {acoplados.map(a => (
                                <tr key={a.id}>
                                    <td>
                                        {editId === a.id ? (
                                            <input className="form-control form-control-sm" value={editData.patente}
                                                onChange={e => setEditData(v => ({ ...v, patente: e.target.value }))} />
                                        ) : a.patente}
                                    </td>
                                    <td className="text-end">
                                        {editId === a.id ? (
                                            <div className="btn-group btn-group-sm">
                                                <button className="btn btn-success" onClick={() => saveEdit(a.id)}><i className="bi bi-check-lg"></i></button>
                                                <button className="btn btn-outline-secondary" onClick={() => setEditId(null)}><i className="bi bi-x-lg"></i></button>
                                            </div>
                                        ) : (
                                            <div className="btn-group btn-group-sm">
                                                <button className="btn btn-outline-primary" onClick={() => { setEditId(a.id); setEditData({ patente: a.patente || '' }); }} title="Editar"><i className="bi bi-pencil"></i></button>
                                                <button className="btn btn-outline-danger" onClick={() => eliminar(a.id)} title="Eliminar"><i className="bi bi-trash"></i></button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

export default function Ceo() {
    const { user } = useAuth();
    const [camiones, setCamiones] = useState([]);
    const [acoplados, setAcoplados] = useState([]);
    const [viajes, setViajes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [nuevoCamion, setNuevoCamion] = useState({ patente: '', marca: '', modelo: '', anio: '' });
    const [camionErrors, setCamionErrors] = useState({});
    const [nuevoViaje, setNuevoViaje] = useState({ origen: '', destino: '', fecha: '', camionId: '', tipoMercaderia: '', cliente: '', precioTonelada: '' });
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', password: '', rol: 'camionero' });
    const [savingCamion, setSavingCamion] = useState(false);
    const [savingViaje, setSavingViaje] = useState(false);
    const [savingUsuario, setSavingUsuario] = useState(false);
    const { showToast } = useToast();
    const [filtroEstado, setFiltroEstado] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [sortKey, setSortKey] = useState('fecha');
    const [sortDir, setSortDir] = useState('desc');
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const compact = true;

    const viajesFinalizados = useMemo(() => (viajes || []).filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajes]);
    // Filtros para gráficos
    const [chartFrom, setChartFrom] = useState('');
    const [chartTo, setChartTo] = useState('');
    const [chartCliente, setChartCliente] = useState('');
    const [chartTipo, setChartTipo] = useState('');

    // Detalle de viaje
    const [detalle, setDetalle] = useState(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const [showDetalleModal, setShowDetalleModal] = useState(false);
    const abrirDetalle = async (id) => {
        setDetalle(null);
        setDetalleLoading(true);
        try {
            const { data } = await api.get(`/viajes/${id}`);
            setDetalle(data);
            // abrir modal
            setTimeout(() => {
                try {
                    const el = document.getElementById('modalDetalleViaje');
                    if (el && window.bootstrap?.Modal) {
                        const modal = window.bootstrap.Modal.getOrCreateInstance(el);
                        modal.show();
                    } else {
                        setShowDetalleModal(true);
                    }
                } catch { setShowDetalleModal(true); }
            }, 10);
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error cargando detalle';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setDetalleLoading(false);
        }
    };

    // Edición de viaje (solo pendientes)
    const [editViajeModal, setEditViajeModal] = useState({ open: false, id: null, data: { origen: '', destino: '', fecha: '', camionId: '', acopladoId: '', tipoMercaderia: '', cliente: '' }, loading: false, error: '' });
    const openEditViaje = (v) => {
        setEditViajeModal({
            open: true,
            id: v.id,
            data: {
                origen: v.origen || '',
                destino: v.destino || '',
                fecha: v.fecha ? new Date(v.fecha).toISOString().slice(0, 10) : '',
                camionId: v.camion?.id || v.camionId || '',
                acopladoId: v.acoplado?.id || v.acopladoId || '',
                tipoMercaderia: v.tipoMercaderia || '',
                cliente: v.cliente || ''
            },
            loading: false,
            error: ''
        });
    };
    const closeEditViaje = () => setEditViajeModal({ open: false, id: null, data: { origen: '', destino: '', fecha: '', camionId: '', acopladoId: '', tipoMercaderia: '', cliente: '' }, loading: false, error: '' });
    const saveEditViaje = async () => {
        if (!editViajeModal.id) return;
        setEditViajeModal(m => ({ ...m, loading: true, error: '' }));
        try {
            const body = {
                ...editViajeModal.data,
                camionId: editViajeModal.data.camionId ? Number(editViajeModal.data.camionId) : undefined,
                acopladoId: editViajeModal.data.acopladoId ? Number(editViajeModal.data.acopladoId) : null,
                tipoMercaderia: editViajeModal.data.tipoMercaderia?.trim() || null,
                cliente: editViajeModal.data.cliente?.trim() || null
            };
            await api.patch(`/viajes/${editViajeModal.id}`, body);
            showToast('Viaje actualizado', 'success');
            closeEditViaje();
            await fetchViajes();
        } catch (e) {
            setEditViajeModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error actualizando viaje' }));
        }
    };

    const fetchCamiones = async () => {
        const { data } = await api.get('/camiones?limit=100');
        const list = (data.items || data.data || []);
        setCamiones(list);
        return list;
    };
    const fetchViajes = async () => {
        const { data } = await api.get('/viajes?limit=100');
        const list = data.items || data.data || [];
        setViajes(list);
        return list;
    };
    const fetchAcoplados = async () => {
        const { data } = await api.get('/acoplados');
        const list = Array.isArray(data) ? data : (data.items || data.data || []);
        setAcoplados(list);
        return list;
    };
    const fetchUsuarios = async () => {
        const { data } = await api.get('/usuarios');
        const list = Array.isArray(data) ? data : (data.items || []);
        setUsuarios(list);
        return list;
    };

    const openFinalizarModal = (id) => {
        setModalFinalizarId(id);
        setFinalizarData({ km: '', combustible: '', kilosCargados: '' });
        setFinalizarPasoConfirm(false);
        setConfirmChecked(false);
        setTimeout(() => {
            try {
                const el = document.getElementById('modalFinalizarCeo');
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

    const finalizarViaje = async (id) => {
        setError('');
        if (!finalizarPasoConfirm) {
            if (String(finalizarData.km).trim() === '' || String(finalizarData.combustible).trim() === '') {
                showToast('Complet\u00e1 km y combustible', 'error');
                return;
            }
            const kmNum = Number(finalizarData.km);
            const combNum = Number(finalizarData.combustible);
            if (isNaN(kmNum) || kmNum <= 0) {
                showToast('Ingres\u00e1 KM mayor a 0', 'error');
                return;
            }
            if (isNaN(combNum) || combNum <= 0) {
                showToast('Ingres\u00e1 combustible mayor a 0', 'error');
                return;
            }
            setFinalizarPasoConfirm(true);
            return;
        }
        setFinishingId(id);
        try {
            const body = { km: Number(finalizarData.km), combustible: Number(finalizarData.combustible) };
            if (String(finalizarData.kilosCargados).trim() !== '') body.kilosCargados = Number(finalizarData.kilosCargados);
            await api.patch(`/viajes/${id}/finalizar`, body);
            setFinalizarData({ km: '', combustible: '', kilosCargados: '' });
            await new Promise(r => setTimeout(r, 400));
            await fetchViajes();
            showToast('Viaje finalizado', 'success');
            try {
                const el = document.getElementById('modalFinalizarCeo');
                if (el && window.bootstrap?.Modal) {
                    const modal = window.bootstrap.Modal.getOrCreateInstance(el);
                    modal.hide();
                }
            } catch { /* no-op */ }
            setShowFinalizarModal(false);
            setModalFinalizarId(null);
        } catch (e) {
            const msg = e?.response?.data?.error || 'No se pudo finalizar';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setFinishingId(null);
        }
    };

    // Exportar listado a PDF
    const exportViajesPDF = (scope = 'filtro') => {
        const set = scope === 'pagina' ? viajesPagina : viajesOrdenados;
        const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Acoplado', 'Camionero', 'Tipo', 'Cliente', 'Km', 'Combustible', 'Kilos', 'Precio/Tn', 'Importe'];
        const rows = set.map(v => [
            formatDateOnly(v.fecha),
            v.estado || '',
            v.origen || '',
            v.destino || '',
            v.camion?.patente || v.camionId || '',
            v.acoplado?.patente || v.acopladoPatente || '',
            v.camionero?.nombre || '',
            v.tipoMercaderia || '',
            v.cliente || '',
            v.km ?? '',
            v.combustible ?? '',
            v.kilosCargados ?? '',
            v.precioTonelada ?? '',
            v.importe ?? ''
        ]);
        generarListadoViajesPDF(`Listado de viajes (${scope})`, headers, rows, `viajes_${scope}.pdf`);
        showToast(`Exportado PDF (${scope})`, 'success');
    };

    // Filtros adicionales
    const [filtroCamion, setFiltroCamion] = useState('');
    const [filtroCamionero, setFiltroCamionero] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroCliente, setFiltroCliente] = useState('');
    const camionesOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => { const pat = v.camion?.patente || v.camionId; if (pat) set.add(pat); });
        return Array.from(set);
    }, [viajes]);
    const camionerosOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => { const nom = v.camionero?.nombre; if (nom) set.add(nom); });
        return Array.from(set);
    }, [viajes]);
    const tiposOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => { const t = v.tipoMercaderia?.trim(); if (t) set.add(t); });
        return Array.from(set);
    }, [viajes]);
    const clientesOpciones = useMemo(() => {
        const set = new Set();
        viajes.forEach(v => { const c = v.cliente?.trim(); if (c) set.add(c); });
        return Array.from(set);
    }, [viajes]);

    // Lista de usuarios camioneros para asignar a camiones
    const camioneros = useMemo(() => (usuarios || []).filter(u => u.rol === 'camionero'), [usuarios]);

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try { await Promise.all([fetchCamiones(), fetchAcoplados(), fetchViajes(), fetchUsuarios()]); }
            catch (e) { setError(e?.response?.data?.error || 'Error cargando datos'); }
            finally { setLoading(false); }
        })();
    }, []);

    // Inicialización de tooltips de Bootstrap: se coloca más abajo, después de calcular viajesPagina

    const validarPatente = (pat) => {
        if (!pat) return 'La patente es requerida';
        const p = String(pat).toUpperCase().trim();
        const ok = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/.test(p);
        return ok ? '' : 'Formato inválido (use AAA123 o AB123CD)';
    };

    const validarNuevoCamion = (camion) => {
        const errs = {};
        const pErr = validarPatente(camion.patente);
        if (pErr) errs.patente = pErr;
        if (!camion.marca?.trim()) errs.marca = 'La marca es requerida';
        if (!camion.modelo?.trim()) errs.modelo = 'El modelo es requerido';
        const an = Number(camion.anio);
        if (!an || an < 1900) errs.anio = 'El año debe ser >= 1900';
        return errs;
    };

    const crearCamion = async (e) => {
        e.preventDefault();
        setError('');
        const normalized = {
            patente: String(nuevoCamion.patente || '').toUpperCase().trim(),
            marca: nuevoCamion.marca,
            modelo: nuevoCamion.modelo,
            anio: nuevoCamion.anio
        };
        const errs = validarNuevoCamion(normalized);
        setCamionErrors(errs);
        if (Object.keys(errs).length) {
            showToast(Object.values(errs)[0], 'error');
            return;
        }
        setSavingCamion(true);
        try {
            const body = { ...normalized, anio: Number(normalized.anio) || null };
            const { data: created } = await api.post('/camiones', body);
            setNuevoCamion({ patente: '', marca: '', modelo: '', anio: '' });
            setCamionErrors({});
            const list = await fetchCamiones();
            const newId = created?.id ?? (list.find(c => c.patente === body.patente)?.id);
            if (newId) {
                setSavedCamionId(newId);
                setTimeout(() => setSavedCamionId(null), 2000);
            }
            showToast('Camión creado', 'success');
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error creando camión';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setSavingCamion(false);
        }
    };

    const crearViaje = async (e) => {
        e.preventDefault();
        setError('');
        setSavingViaje(true);
        try {
            const body = {
                ...nuevoViaje,
                camionId: Number(nuevoViaje.camionId) || 0,
                acopladoId: nuevoViaje.acopladoId ? Number(nuevoViaje.acopladoId) : null,
                tipoMercaderia: nuevoViaje.tipoMercaderia?.trim() || null,
                cliente: nuevoViaje.cliente?.trim() || null,
                precioTonelada: nuevoViaje.precioTonelada ? Number(nuevoViaje.precioTonelada) : undefined
            };
            await api.post('/viajes', body);
            setNuevoViaje({ origen: '', destino: '', fecha: '', camionId: '', acopladoId: '', tipoMercaderia: '', cliente: '', precioTonelada: '' });
            await fetchViajes();
            showToast('Viaje creado', 'success');
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error creando viaje';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setSavingViaje(false);
        }
    };

    const crearUsuario = async (e) => {
        e.preventDefault();
        setError('');
        setSavingUsuario(true);
        try {
            const body = {
                nombre: (nuevoUsuario.nombre || '').trim(),
                email: (nuevoUsuario.email || '').trim(),
                password: nuevoUsuario.password || '',
                rol: nuevoUsuario.rol
            };
            const { data: created } = await api.post('/usuarios', body);
            setNuevoUsuario({ nombre: '', email: '', password: '', rol: 'camionero' });
            const list = await fetchUsuarios();
            const newId = created?.id ?? (list.find(u => u.email === created?.email || u.email === nuevoUsuario.email)?.id);
            if (newId) {
                setSavedUsuarioId(newId);
                setTimeout(() => setSavedUsuarioId(null), 2000);
            }
            showToast('Usuario creado', 'success');
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error creando usuario';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setSavingUsuario(false);
        }
    };

    const reporte = useMemo(() => {
        const total = viajes.length;
        const porEstado = viajes.reduce((acc, v) => { acc[v.estado] = (acc[v.estado] || 0) + 1; return acc; }, {});
        const km = viajes.reduce((sum, v) => sum + (Number(v.km) || 0), 0);
        const combustible = viajes.reduce((sum, v) => sum + (Number(v.combustible) || 0), 0);
        return { total, porEstado, km, combustible };
    }, [viajes]);

    // Datos para gráficos
    const estadoChart = useMemo(() => {
        const order = ['pendiente', 'en curso', 'finalizado'];
        const colors = { 'pendiente': '#f59e0b', 'en curso': '#22d3ee', 'finalizado': '#22c55e' };
        const total = viajes.length || 0;
        const items = order.map(k => ({ label: k, value: reporte.porEstado[k] || 0, color: colors[k] }));
        // conic-gradient stops
        let acc = 0;
        const stops = total === 0 ? [`var(--bs-border-color) 0 100%`] : items.filter(i => i.value > 0).map(i => {
            const pct = Math.round((i.value / total) * 1000) / 10; // 0.1%
            const seg = `${i.color} ${acc}% ${acc + pct}%`;
            acc += pct;
            return seg;
        });
        return { total, items, bg: `conic-gradient(${stops.join(',')})` };
    }, [reporte.porEstado, viajes.length]);

    const porCamioneroTop = useMemo(() => {
        const map = viajes.reduce((acc, v) => {
            const key = v.camionero?.nombre || '-';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const list = Object.entries(map).map(([label, value]) => ({ label, value }));
        list.sort((a, b) => b.value - a.value);
        return list.slice(0, 5);
    }, [viajes]);

    const porCamionTop = useMemo(() => {
        const map = viajes.reduce((acc, v) => {
            const key = v.camion ? `${v.camion.patente} (${v.camion.marca})` : (v.camionId || '-');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        const list = Object.entries(map).map(([label, value]) => ({ label, value }));
        list.sort((a, b) => b.value - a.value);
        return list.slice(0, 5);
    }, [viajes]);

    const viajesFiltrados = useMemo(() => {
        const term = busqueda.trim().toLowerCase();
        // Aplica filtros de tabla + filtros de gráficos (fecha, cliente, tipo)
        return viajes.filter(v => {
            const okEstado = !filtroEstado || v.estado === filtroEstado;
            const text = `${v.origen ?? ''} ${v.destino ?? ''} ${v.tipoMercaderia ?? ''} ${v.cliente ?? ''} ${v.camion?.patente ?? v.camionId ?? ''} ${v.acoplado?.patente ?? v.acopladoPatente ?? ''} ${v.camionero?.nombre ?? ''}`.toLowerCase();
            const okTexto = !term || text.includes(term);
            const okCamion = !filtroCamion || (v.camion?.patente || v.camionId || '') === filtroCamion;
            const okCamionero = !filtroCamionero || (v.camionero?.nombre || '') === filtroCamionero;
            const okTipo = !filtroTipo || (v.tipoMercaderia || '') === filtroTipo;
            const okCliente = !filtroCliente || (v.cliente || '') === filtroCliente;
            // Filtros del panel de gráficos
            const okTipoChart = !chartTipo || (v.tipoMercaderia || '') === chartTipo;
            const okClienteChart = !chartCliente || (v.cliente || '') === chartCliente;
            const okFechaChart = (() => {
                if (!chartFrom && !chartTo) return true;
                const ts = parseDateOnlyLocal(v.fecha);
                const fromTs = chartFrom ? parseDateOnlyLocal(chartFrom) : null;
                const toTs = chartTo ? parseDateOnlyLocal(chartTo) : null;
                if (fromTs && ts < fromTs) return false;
                if (toTs && ts > toTs) return false;
                return true;
            })();
            return okEstado && okTexto && okCamion && okCamionero && okTipo && okCliente && okTipoChart && okClienteChart && okFechaChart;
        });
    }, [viajes, filtroEstado, busqueda, filtroCamion, filtroCamionero, filtroTipo, filtroCliente, chartFrom, chartTo, chartCliente, chartTipo]);

    // Helpers de fecha (DATEONLY -> local)
    const parseDateOnlyLocal = (s) => {
        if (!s) return 0;
        try { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1).getTime(); } catch { return 0; }
    };
    const formatDateOnly = (s) => {
        if (!s) return '';
        try { const [y, m, d] = String(s).split('-').map(Number); const dt = new Date(y, (m || 1) - 1, d || 1); return dt.toLocaleDateString(); } catch { return s; }
    };

    const viajesOrdenados = useMemo(() => {
        const arr = [...viajesFiltrados];
        const dir = sortDir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            const getVal = (v, k) => {
                switch (k) {
                    case 'fecha': return parseDateOnlyLocal(v.fecha || 0);
                    case 'origen': return (v.origen || '').toLowerCase();
                    case 'destino': return (v.destino || '').toLowerCase();
                    case 'estado': return (v.estado || '').toLowerCase();
                    case 'camion': return ((v.camion?.patente || v.camionId || '') + '').toString().toLowerCase();
                    case 'acoplado': return ((v.acoplado?.patente || v.acopladoPatente || '') + '').toString().toLowerCase();
                    case 'camionero': return (v.camionero?.nombre || '').toLowerCase();
                    case 'tipo': return (v.tipoMercaderia || '').toLowerCase();
                    case 'cliente': return (v.cliente || '').toLowerCase();
                    case 'km': return Number(v.km) || 0;
                    case 'combustible': return Number(v.combustible) || 0;
                    default: return '';
                }
            }
            const va = getVal(a, sortKey);
            const vb = getVal(b, sortKey);
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        return arr;
    }, [viajesFiltrados, sortKey, sortDir]);

    const totalPages = Math.max(1, Math.ceil(viajesFiltrados.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const viajesPagina = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return viajesOrdenados.slice(start, start + pageSize);
    }, [viajesOrdenados, currentPage]);

    // (Se reemplaza CSV por PDF)

    // Inicialización de tooltips de Bootstrap para elementos con data-bs-toggle="tooltip"
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
    }, [viajesPagina, viajesOrdenados, viajesFiltrados, sortKey, sortDir, currentPage]);

    // Edición inline de camiones
    const [editCamionId, setEditCamionId] = useState(null);
    const [editCamionData, setEditCamionData] = useState({ patente: '', marca: '', modelo: '', anio: '' });
    const [savedCamionId, setSavedCamionId] = useState(null);

    const startEditCamion = (c) => {
        setEditCamionId(c.id);
        setEditCamionData({ patente: c.patente || '', marca: c.marca || '', modelo: c.modelo || '', anio: c.anio || '' });
    };
    const cancelEditCamion = () => { setEditCamionId(null); };
    const saveEditCamion = async (id) => {
        try {
            const body = { ...editCamionData, anio: editCamionData.anio ? Number(editCamionData.anio) : null };
            if (body.patente) {
                body.patente = String(body.patente).toUpperCase().trim();
                const pErr = validarPatente(body.patente);
                if (pErr) { showToast(pErr, 'error'); return; }
            }
            await api.put(`/camiones/${id}`, body);
            showToast('Camión actualizado', 'success');
            setEditCamionId(null);
            await fetchCamiones();
            setSavedCamionId(id);
            setTimeout(() => setSavedCamionId(null), 2000);
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error actualizando camión';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    const deleteCamion = async (id) => {
        setConfirmModal({
            show: true,
            title: 'Eliminar camión',
            message: '¿Estás seguro que deseas eliminar este camión? Esta acción no se puede deshacer.',
            onConfirm: async () => {
                try {
                    await api.delete(`/camiones/${id}`);
                    showToast('Camión eliminado', 'success');
                    await fetchCamiones();
                } catch (e) {
                    const msg = e?.response?.data?.error || 'Error eliminando camión';
                    setError(msg);
                    showToast(msg, 'error');
                } finally {
                    setConfirmModal({ show: false });
                }
            },
            onCancel: () => setConfirmModal({ show: false })
        });
    };

    // Edición inline de usuarios
    const [confirmModal, setConfirmModal] = useState({ show: false });
    const [editUsuarioId, setEditUsuarioId] = useState(null);
    const [editUsuarioData, setEditUsuarioData] = useState({ nombre: '', email: '', rol: 'camionero', password: '', changePassword: false, showPassword: false });
    const [savedUsuarioId, setSavedUsuarioId] = useState(null);

    // Estados para finalizar viaje (CEO puede finalizar viajes en curso)
    const [finalizarData, setFinalizarData] = useState({ km: '', combustible: '', kilosCargados: '' });
    const [finalizarPasoConfirm, setFinalizarPasoConfirm] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);
    const [showFinalizarModal, setShowFinalizarModal] = useState(false);
    const [modalFinalizarId, setModalFinalizarId] = useState(null);
    const [finishingId, setFinishingId] = useState(null);

    const startEditUsuario = (u) => {
        setEditUsuarioId(u.id);
        setEditUsuarioData({ nombre: u.nombre || '', email: u.email || '', rol: u.rol || 'camionero', password: '', changePassword: false, showPassword: false });
    };
    const cancelEditUsuario = () => {
        setEditUsuarioId(null);
        setEditUsuarioData({ nombre: '', email: '', rol: 'camionero', password: '', changePassword: false, showPassword: false });
    };
    const saveEditUsuario = async (id) => {
        try {
            // Evitar enviar cambio de rol si el usuario editado es CEO
            const current = usuarios.find(u => u.id === id);
            const body = { nombre: editUsuarioData.nombre, email: editUsuarioData.email };
            if (current?.rol !== 'ceo') {
                body.rol = editUsuarioData.rol;
            }
            if (editUsuarioData.changePassword && editUsuarioData.password && editUsuarioData.password.trim().length > 0) {
                body.password = editUsuarioData.password.trim();
            }
            await api.put(`/usuarios/${id}`, body);
            showToast('Usuario actualizado', 'success');
            setEditUsuarioId(null);
            await fetchUsuarios();
            setSavedUsuarioId(id);
            setTimeout(() => setSavedUsuarioId(null), 2000);
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error actualizando usuario';
            setError(msg);
            showToast(msg, 'error');
        }
    };
    const deleteUsuario = async (id) => {
        if (!confirm('¿Eliminar usuario? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/usuarios/${id}`);
            showToast('Usuario eliminado', 'success');
            await fetchUsuarios();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error eliminando usuario';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    // Notificaciones (campana)
    const [notisOpen, setNotisOpen] = useState(false);
    const [notis, setNotis] = useState([]);
    const [loadingNotis, setLoadingNotis] = useState(false);
    const [bellPulse, setBellPulse] = useState(false);
    const unreadCount = useMemo(() => (notis || []).filter(n => !n.leida).length, [notis]);
    const [prevUnread, setPrevUnread] = useState(0);
    const AUTO_OPEN_THRESHOLD = Number(import.meta?.env?.VITE_NOTIS_AUTO_OPEN_THRESHOLD ?? 3);

    // Helpers de presentación para notificaciones
    const tipoConfig = {
        viaje_tomado: { icon: 'bi-truck', bg: 'bg-primary-subtle', dot: 'bg-primary' },
        factura_vencida: { icon: 'bi-exclamation-triangle', bg: 'bg-warning-subtle', dot: 'bg-warning' },
        por_defecto: { icon: 'bi-bell', bg: 'bg-secondary-subtle', dot: 'bg-secondary' }
    };
    const getTipoCfg = (tipo) => tipoConfig[tipo] || tipoConfig.por_defecto;
    const relTime = (d) => {
        try {
            const ts = typeof d === 'string' || typeof d === 'number' ? new Date(d).getTime() : d?.getTime?.();
            if (!ts) return '';
            const diff = Math.floor((Date.now() - ts) / 1000);
            if (diff < 60) return 'hace unos segundos';
            if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
            if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
            return `hace ${Math.floor(diff / 86400)} d`;
        } catch { return ''; }
    };
    // Cargar/actualizar notificaciones
    const fetchNotis = async () => {
        try {
            setLoadingNotis(true);
            const { data } = await api.get('/notificaciones');
            const list = Array.isArray(data) ? data : (data.items || []);
            setNotis(list);
            const newUnread = (list || []).filter(n => !n.leida).length;
            if (newUnread > prevUnread) {
                setBellPulse(true);
                setTimeout(() => setBellPulse(false), 1200);
                if (!notisOpen && newUnread >= AUTO_OPEN_THRESHOLD) setNotisOpen(true);
            }
            setPrevUnread(newUnread);
        } catch {
            // noop
        } finally {
            setLoadingNotis(false);
        }
    };

    // Auto-cargar cuando el usuario sea CEO
    useEffect(() => {
        if (user?.rol === 'ceo') fetchNotis();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.rol]);

    // Polling cada 60s sólo si el usuario es CEO
    useEffect(() => {
        if (user?.rol !== 'ceo') return;
        const id = setInterval(() => { fetchNotis(); }, 60000);
        return () => clearInterval(id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.rol]);

    return (
        <>
            <ConfirmModal
                show={confirmModal.show}
                title={confirmModal.title}
                message={confirmModal.message}
                onConfirm={confirmModal.onConfirm}
                onCancel={confirmModal.onCancel}
                requireText={confirmModal.requireText}
                expectedText={confirmModal.expectedText}
            />
            <div className="container py-3 space-y-4">
                <PageHeader title="Panel CEO" subtitle="Gestión de camiones, viajes y usuarios" actions={(
                    <div className="d-flex align-items-center gap-2">
                        {loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
                        {user?.rol === 'ceo' && (
                            <div className="position-relative">
                                <button className={`btn btn-outline-secondary position-relative ${bellPulse ? 'notif-pulse' : ''}`} onClick={() => { setNotisOpen(v => !v); if (!notisOpen) fetchNotis(); }}>
                                    <i className="bi bi-bell"></i>
                                    {unreadCount > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unreadCount}</span>}
                                </button>
                                {notisOpen && (
                                    <div className="card position-absolute end-0 mt-2 shadow" style={{ minWidth: 420, zIndex: 1000 }}>
                                        <div className="card-header d-flex align-items-center py-2 gap-2">
                                            <strong>Notificaciones</strong>
                                            <span className={`badge ${unreadCount > 0 ? 'text-bg-danger' : 'text-bg-secondary'} ms-1`}>{unreadCount} sin leer</span>
                                            <div className="ms-auto d-flex gap-1">
                                                <button className="btn btn-sm btn-outline-warning" title="Borrar leídas" onClick={async () => {
                                                    if (!confirm('¿Borrar todas las notificaciones leídas?')) return;
                                                    try { await api.delete('/notificaciones/leidas/all'); } catch { }
                                                    finally { fetchNotis(); }
                                                }}>
                                                    <i className="bi bi-check2-square me-1"></i> Borrar leídas
                                                </button>
                                            </div>
                                        </div>
                                        <div className="list-group list-group-flush" style={{ maxHeight: 380, overflowY: 'auto' }}>
                                            {(notis || []).length === 0 ? (
                                                <div className="text-center text-body-secondary p-3">Sin notificaciones</div>
                                            ) : (
                                                (notis || []).map(n => {
                                                    const cfg = getTipoCfg(n.tipo);
                                                    return (
                                                        <div key={n.id} className={`list-group-item d-flex align-items-start gap-2`}>
                                                            <div className={`rounded-circle d-flex align-items-center justify-content-center ${cfg.bg}`} style={{ width: 36, height: 36, position: 'relative' }}>
                                                                <i className={`bi ${cfg.icon}`}></i>
                                                                {!n.leida && <span className={`position-absolute top-0 end-0 translate-middle p-1 border border-light rounded-circle ${cfg.dot}`}></span>}
                                                            </div>
                                                            <div className="flex-grow-1">
                                                                <div className="d-flex align-items-center gap-2 mb-1">
                                                                    <span className="badge text-bg-light text-capitalize border">{n.tipo.replaceAll('_', ' ')}</span>
                                                                    {!n.leida && <span className="badge text-bg-warning">Nuevo</span>}
                                                                    <span className="text-body-secondary small ms-auto">{relTime(n.fecha)} · {new Date(n.fecha).toLocaleString()}</span>
                                                                </div>
                                                                <div className="small">{n.mensaje}</div>
                                                            </div>
                                                            <div className="d-flex flex-column gap-1 align-items-end">
                                                                {!n.leida && (
                                                                    <button className="btn btn-sm btn-outline-primary" onClick={async () => { await api.patch(`/notificaciones/${n.id}/leida`); setNotis(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x)); }}>
                                                                        <i className="bi bi-check2 me-1"></i> Leída
                                                                    </button>
                                                                )}
                                                                <button className="btn btn-sm btn-outline-danger" title="Eliminar" onClick={async () => {
                                                                    if (!confirm('¿Eliminar esta notificación?')) return;
                                                                    try { await api.delete(`/notificaciones/${n.id}`); setNotis(prev => prev.filter(x => x.id !== n.id)); } catch { }
                                                                }}>
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )} />

                {/* KPIs rápidos */}
                <div className="row g-3 mb-2">
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100 kpi-card">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">Viajes</div>
                                <div className="fs-4 fw-bold">{reporte.total}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100 kpi-card">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">En curso</div>
                                <div className="fs-4 fw-bold">{viajes.filter(v => v.estado === 'en curso').length}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100 kpi-card">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">Finalizados</div>
                                <div className="fs-4 fw-bold">{viajes.filter(v => v.estado === 'finalizado').length}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100 kpi-card">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">Km totales</div>
                                <div className="fs-4 fw-bold">{reporte.km}</div>
                            </div>
                        </div>
                    </div>
                </div>
                {error && <div className="alert alert-danger" role="alert">{error}</div>}

                <div className="row g-3">
                    <div className="col-lg-6">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Crear camión</h3>
                                <form onSubmit={crearCamion} className="row g-2 mt-2" style={{ opacity: savingCamion ? 0.85 : 1 }}>
                                    <div className="col-6">
                                        <input
                                            className={`form-control ${camionErrors.patente ? 'is-invalid' : ''}`}
                                            placeholder="Patente (AAA123 o AB123CD)"
                                            value={nuevoCamion.patente}
                                            onChange={e => {
                                                const val = e.target.value.toUpperCase();
                                                setNuevoCamion(v => ({ ...v, patente: val }));
                                                const err = validarPatente(val);
                                                setCamionErrors(prev => ({ ...prev, patente: err }));
                                            }}
                                        />
                                        {camionErrors.patente && <div className="invalid-feedback">{camionErrors.patente}</div>}
                                    </div>
                                    <div className="col-6">
                                        <input
                                            className={`form-control ${camionErrors.marca ? 'is-invalid' : ''}`}
                                            placeholder="Marca"
                                            value={nuevoCamion.marca}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNuevoCamion(v => ({ ...v, marca: val }));
                                                setCamionErrors(prev => ({ ...prev, marca: val.trim() ? '' : 'La marca es requerida' }));
                                            }}
                                        />
                                        {camionErrors.marca && <div className="invalid-feedback">{camionErrors.marca}</div>}
                                    </div>
                                    <div className="col-6">
                                        <input
                                            className={`form-control ${camionErrors.modelo ? 'is-invalid' : ''}`}
                                            placeholder="Modelo"
                                            value={nuevoCamion.modelo}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNuevoCamion(v => ({ ...v, modelo: val }));
                                                setCamionErrors(prev => ({ ...prev, modelo: val.trim() ? '' : 'El modelo es requerido' }));
                                            }}
                                        />
                                        {camionErrors.modelo && <div className="invalid-feedback">{camionErrors.modelo}</div>}
                                    </div>
                                    <div className="col-6">
                                        <input
                                            className={`form-control ${camionErrors.anio ? 'is-invalid' : ''}`}
                                            placeholder="Año"
                                            value={nuevoCamion.anio}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setNuevoCamion(v => ({ ...v, anio: val }));
                                                const num = Number(val);
                                                setCamionErrors(prev => ({ ...prev, anio: (!num || num < 1900) ? 'El año debe ser >= 1900' : '' }));
                                            }}
                                        />
                                        {camionErrors.anio && <div className="invalid-feedback">{camionErrors.anio}</div>}
                                    </div>
                                    <div className="col-12"><button className="btn btn-primary" disabled={savingCamion || Object.values(camionErrors).some(Boolean)}>{savingCamion ? 'Guardando…' : 'Guardar'}</button></div>
                                </form>
                                <div className="table-responsive mt-3">
                                    {camiones.length === 0 ? (
                                        <EmptyState title="Sin camiones" description="Todavía no cargaste ningún camión" />
                                    ) : (
                                        <table className={`table table-sm table-hover align-middle mb-0 table-sticky table-cols-bordered`}>
                                            <thead>
                                                <tr>
                                                    {['Patente', 'Marca', 'Modelo', 'Año', 'Camionero asignado'].map(label => (
                                                        <th key={label} className="text-uppercase small" style={{ verticalAlign: 'middle', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                                                            <div className="d-inline-flex align-items-center gap-1"><span>{label}</span></div>
                                                        </th>
                                                    ))}
                                                    <th className="text-end text-uppercase small" style={{ verticalAlign: 'middle', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {camiones.map(c => (
                                                    <tr key={c.id} className={savedCamionId === c.id ? 'table-success row-saved-anim' : ''}>
                                                        <td>
                                                            {editCamionId === c.id ? (
                                                                <input className="form-control form-control-sm" value={editCamionData.patente} onChange={e => setEditCamionData(v => ({ ...v, patente: e.target.value }))} />
                                                            ) : c.patente}
                                                        </td>
                                                        <td>
                                                            {editCamionId === c.id ? (
                                                                <input className="form-control form-control-sm" value={editCamionData.marca} onChange={e => setEditCamionData(v => ({ ...v, marca: e.target.value }))} />
                                                            ) : c.marca}
                                                        </td>
                                                        <td>
                                                            {editCamionId === c.id ? (
                                                                <input className="form-control form-control-sm" value={editCamionData.modelo} onChange={e => setEditCamionData(v => ({ ...v, modelo: e.target.value }))} />
                                                            ) : c.modelo}
                                                        </td>
                                                        <td style={{ maxWidth: 90 }}>
                                                            {editCamionId === c.id ? (
                                                                <input className="form-control form-control-sm" type="number" value={editCamionData.anio} onChange={e => setEditCamionData(v => ({ ...v, anio: e.target.value }))} />
                                                            ) : (c.anio || '-')}
                                                        </td>
                                                        <td style={{ minWidth: 220 }}>
                                                            {camioneros.length === 0 ? (
                                                                <span className="text-body-secondary small">Sin camioneros cargados</span>
                                                            ) : (
                                                                <select
                                                                    className="form-select form-select-sm"
                                                                    value={c.camioneroId || ''}
                                                                    onChange={async (e) => {
                                                                        const value = e.target.value;
                                                                        try {
                                                                            const body = value ? { camioneroId: Number(value) } : { camioneroId: null };
                                                                            await api.post(`/camiones/${c.id}/asignarCamionero`, body);
                                                                            showToast('Camionero asignado al camión', 'success');
                                                                            await fetchCamiones();
                                                                        } catch (err) {
                                                                            const msg = err?.response?.data?.error || 'Error al asignar camionero';
                                                                            setError(msg);
                                                                            showToast(msg, 'error');
                                                                        }
                                                                    }}
                                                                >
                                                                    <option value="">Sin asignar</option>
                                                                    {camioneros.map(cm => (
                                                                        <option key={cm.id} value={cm.id}>{cm.nombre} ({cm.email})</option>
                                                                    ))}
                                                                </select>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            {editCamionId === c.id ? (
                                                                <div className="btn-group btn-group-sm">
                                                                    <button className="btn btn-success" onClick={() => saveEditCamion(c.id)}><i className="bi bi-check-lg"></i></button>
                                                                    <button className="btn btn-outline-secondary" onClick={cancelEditCamion}><i className="bi bi-x-lg"></i></button>
                                                                </div>
                                                            ) : (
                                                                <div className="btn-group btn-group-sm">
                                                                    <button className="btn btn-outline-primary" onClick={() => startEditCamion(c)} title="Editar"><i className="bi bi-pencil"></i></button>
                                                                    <button className="btn btn-outline-danger" onClick={() => deleteCamion(c.id)} title="Eliminar"><i className="bi bi-trash"></i></button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Crear viaje</h3>
                                <form onSubmit={crearViaje} className="row g-2 mt-2" style={{ opacity: savingViaje ? 0.85 : 1 }}>
                                    <div className="col-6"><input className="form-control" placeholder="Origen" value={nuevoViaje.origen} onChange={e => setNuevoViaje(v => ({ ...v, origen: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" placeholder="Destino" value={nuevoViaje.destino} onChange={e => setNuevoViaje(v => ({ ...v, destino: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" placeholder="Tipo de mercadería" value={nuevoViaje.tipoMercaderia} onChange={e => setNuevoViaje(v => ({ ...v, tipoMercaderia: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" placeholder="Cliente" value={nuevoViaje.cliente} onChange={e => setNuevoViaje(v => ({ ...v, cliente: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" type="date" placeholder="Fecha" value={nuevoViaje.fecha} onChange={e => setNuevoViaje(v => ({ ...v, fecha: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" type="number" min={0} step={0.01} placeholder="Precio por tonelada" value={nuevoViaje.precioTonelada} onChange={e => setNuevoViaje(v => ({ ...v, precioTonelada: e.target.value }))} /></div>
                                    <div className="col-6">
                                        <select className="form-select" value={nuevoViaje.camionId} onChange={e => setNuevoViaje(v => ({ ...v, camionId: e.target.value }))}>
                                            <option value="">Seleccioná camión</option>
                                            {camiones.map(c => <option key={c.id} value={c.id}>{c.patente}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <select className="form-select" value={nuevoViaje.acopladoId || ''} onChange={e => setNuevoViaje(v => ({ ...v, acopladoId: e.target.value }))}>
                                            <option value="">Seleccioná acoplado</option>
                                            {acoplados.map(a => <option key={a.id} value={a.id}>{a.patente}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-12"><button className="btn btn-primary" disabled={savingViaje}>{savingViaje ? 'Guardando…' : 'Guardar'}</button></div>
                                </form>
                            </div>
                        </div>
                    </div>
                    <div className="col-lg-6">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Acoplados</h3>
                                <AcopladosCrud
                                    acoplados={acoplados}
                                    onCreated={async () => { await fetchAcoplados(); showToast('Acoplado creado', 'success'); }}
                                    onUpdated={async () => { await fetchAcoplados(); showToast('Acoplado actualizado', 'success'); }}
                                    onDeleted={async () => { await fetchAcoplados(); showToast('Acoplado eliminado', 'success'); }}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card shadow-sm">
                    <div className="card-body">
                        <div className="d-flex flex-wrap gap-2 align-items-end mb-2">
                            <h3 className="h5 mb-0 me-auto">Viajes</h3>
                            <div>
                                <label className="form-label mb-1">Estado</label>
                                <select className="form-select form-select-sm" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}>
                                    <option value="">Todos</option>
                                    <option value="pendiente">Pendiente</option>
                                    <option value="en curso">En curso</option>
                                    <option value="finalizado">Finalizado</option>
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Camión</label>
                                <select className="form-select form-select-sm" value={filtroCamion} onChange={e => { setFiltroCamion(e.target.value); setPage(1); }}>
                                    <option value="">Todos</option>
                                    {camionesOpciones.map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Camionero</label>
                                <select className="form-select form-select-sm" value={filtroCamionero} onChange={e => { setFiltroCamionero(e.target.value); setPage(1); }}>
                                    <option value="">Todos</option>
                                    {camionerosOpciones.map(n => (
                                        <option key={n} value={n}>{n}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Tipo</label>
                                <select className="form-select form-select-sm" value={filtroTipo} onChange={e => { const val = e.target.value; setFiltroTipo(val); setChartTipo(val); setPage(1); }}>
                                    <option value="">Todos</option>
                                    {tiposOpciones.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Cliente</label>
                                <select className="form-select form-select-sm" value={filtroCliente} onChange={e => { const val = e.target.value; setFiltroCliente(val); setChartCliente(val); setPage(1); }}>
                                    <option value="">Todos</option>
                                    {clientesOpciones.map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Buscar</label>
                                <input className="form-control form-control-sm" placeholder="Origen, destino, tipo, cliente, patente, chofer" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} />
                            </div>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-danger ms-auto"
                                onClick={() => {
                                    setConfirmModal({
                                        show: true,
                                        title: 'Limpiar historial de viajes',
                                        message: 'Esta acción eliminará TODOS los viajes registrados (pendientes, en curso y finalizados).',
                                        requireText: true,
                                        expectedText: 'Confirmar',
                                        onConfirm: async () => {
                                            try {
                                                const { data } = await api.delete('/viajes');
                                                const eliminados = data?.eliminados ?? 0;
                                                showToast(`Historial limpiado (${eliminados} viajes eliminados)`, 'success');
                                                await fetchViajes();
                                            } catch (e) {
                                                const msg = e?.response?.data?.error || 'Error al limpiar historial de viajes';
                                                setError(msg);
                                                showToast(msg, 'error');
                                            } finally {
                                                setConfirmModal({ show: false });
                                            }
                                        },
                                        onCancel: () => setConfirmModal({ show: false })
                                    });
                                }}
                            >
                                Limpiar historial
                            </button>
                        </div>
                        {(filtroEstado || filtroCamion || filtroCamionero || filtroTipo || filtroCliente || busqueda) && (
                            <div className="d-flex flex-wrap filter-chips mb-2">
                                {filtroEstado && (
                                    <span className="filter-chip">Estado: <strong className="ms-1 text-capitalize">{filtroEstado}</strong>
                                        <i className="bi bi-x ms-1" role="button" onClick={() => { setFiltroEstado(''); setPage(1); }}></i>
                                    </span>
                                )}
                                {filtroCamion && (
                                    <span className="filter-chip">Camión: <strong className="ms-1">{filtroCamion}</strong>
                                        <i className="bi bi-x ms-1" role="button" onClick={() => { setFiltroCamion(''); setPage(1); }}></i>
                                    </span>
                                )}
                                {filtroCamionero && (
                                    <span className="filter-chip">Camionero: <strong className="ms-1">{filtroCamionero}</strong>
                                        <i className="bi bi-x ms-1" role="button" onClick={() => { setFiltroCamionero(''); setPage(1); }}></i>
                                    </span>
                                )}
                                {filtroTipo && (
                                    <span className="filter-chip">Tipo: <strong className="ms-1">{filtroTipo}</strong>
                                        <i className="bi bi-x ms-1" role="button" onClick={() => { setFiltroTipo(''); setPage(1); }}></i>
                                    </span>
                                )}
                                {filtroCliente && (
                                    <span className="filter-chip">Cliente: <strong className="ms-1">{filtroCliente}</strong>
                                        <i className="bi bi-x ms-1" role="button" onClick={() => { setFiltroCliente(''); setPage(1); }}></i>
                                    </span>
                                )}
                                {busqueda && (
                                    <span className="filter-chip">Buscar: <strong className="ms-1">{busqueda}</strong>
                                        <i className="bi bi-x ms-1" role="button" onClick={() => { setBusqueda(''); setPage(1); }}></i>
                                    </span>
                                )}
                                <button className="btn btn-sm btn-outline-secondary" onClick={() => { setFiltroEstado(''); setFiltroCamion(''); setFiltroCamionero(''); setFiltroTipo(''); setFiltroCliente(''); setBusqueda(''); setPage(1); }}>
                                    Limpiar filtros
                                </button>
                            </div>
                        )}
                        <div className="d-flex flex-wrap gap-2 mb-2">
                            <button className="btn btn-sm btn-soft-danger" onClick={() => exportViajesPDF('filtro')} title="Exportar PDF (viajes filtrados)">
                                <i className="bi bi-file-earmark-pdf me-1"></i> PDF listado (filtro)
                            </button>
                            <button className="btn btn-sm btn-soft-danger" onClick={() => exportViajesPDF('pagina')} title="Exportar PDF (esta página)">
                                <i className="bi bi-file-earmark-pdf me-1"></i> PDF listado (página)
                            </button>
                        </div>
                        <div className="table-responsive">
                            {viajesFiltrados.length === 0 ? (
                                <EmptyState title="Sin viajes" description="No hay viajes que coincidan con el filtro" />
                            ) : (
                                <table className={`table table-sm table-striped table-hover table-sticky table-cols-bordered`}>
                                    <thead>
                                        <tr>
                                            {['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Acoplado', 'Camionero', 'Tipo', 'Cliente', 'Km', 'Combustible', 'Kilos', 'Precio/Tn', 'Importe'].map((label) => (
                                                <th
                                                    key={label.toLowerCase()}
                                                    role="button"
                                                    onClick={() => {
                                                        const k = label.toLowerCase();
                                                        if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                                        else { setSortKey(k); setSortDir('asc'); }
                                                    }}
                                                    className="text-uppercase small"
                                                    style={{ verticalAlign: 'middle', paddingTop: '0.35rem', paddingBottom: '0.35rem' }}
                                                >
                                                    <div className="d-inline-flex flex-column align-items-center" style={{ lineHeight: 1 }}>
                                                        <span>{label}</span>
                                                        <span className="opacity-75" style={{ fontSize: '0.85em' }}>
                                                            {sortKey === label.toLowerCase() ? (
                                                                <i className={`bi ${sortDir === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`}></i>
                                                            ) : (
                                                                <i className="bi bi-arrow-down-up"></i>
                                                            )}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                            <th className="text-uppercase small" style={{ verticalAlign: 'middle', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viajesPagina.map(v => (
                                            <tr key={v.id}>
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
                                                <td title={v.camion ? `${v.camion.patente} • ${v.camion.marca} ${v.camion.modelo}` : v.camionId} data-bs-toggle="tooltip">
                                                    {v.camion ? (
                                                        <span>{v.camion.patente} <small className="text-body-secondary">({v.camion.marca})</small></span>
                                                    ) : v.camionId}
                                                </td>
                                                <td title={v.acoplado ? v.acoplado.patente : (v.acopladoPatente || '-')} data-bs-toggle="tooltip">{v.acoplado ? v.acoplado.patente : (v.acopladoPatente || '-')}</td>
                                                <td title={v.camionero?.nombre || '-'} data-bs-toggle="tooltip">{v.camionero?.nombre || '-'}</td>
                                                <td title={v.tipoMercaderia || '-'} data-bs-toggle="tooltip">{v.tipoMercaderia || '-'}</td>
                                                <td title={v.cliente || '-'} data-bs-toggle="tooltip">{v.cliente || '-'}</td>
                                                <td className="text-end">{v.km ?? '-'}</td>
                                                <td className="text-end">{v.combustible ?? '-'}</td>
                                                <td className="text-end">{v.kilosCargados ?? '-'}</td>
                                                <td className="text-end">{v.precioTonelada ?? '-'}</td>
                                                <td className="text-end">{v.importe ?? '-'}</td>
                                                <td className="text-end" style={{ width: 180 }}>
                                                    <div className="btn-group btn-group-sm">
                                                        <button className="btn btn-outline-secondary" onClick={() => abrirDetalle(v.id)} title="Ver detalle">
                                                            <i className="bi bi-eye"></i>
                                                        </button>
                                                        {v.estado === 'pendiente' && (
                                                            <>
                                                                <button className="btn btn-outline-primary" onClick={() => openEditViaje(v)} title="Editar">
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button className="btn btn-outline-danger" title="Eliminar" onClick={() => {
                                                                    setConfirmModal({
                                                                        show: true,
                                                                        title: 'Eliminar viaje',
                                                                        message: '¿Estás seguro de eliminar este viaje pendiente? Esta acción no se puede deshacer.',
                                                                        onConfirm: async () => {
                                                                            try { await api.delete(`/viajes/${v.id}`); showToast('Viaje eliminado', 'success'); await fetchViajes(); }
                                                                            catch (e) { const msg = e?.response?.data?.error || 'Error eliminando viaje'; setError(msg); showToast(msg, 'error'); }
                                                                            finally { setConfirmModal({ show: false }); }
                                                                        },
                                                                        onCancel: () => setConfirmModal({ show: false })
                                                                    });
                                                                }}>
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            </>
                                                        )}
                                                        {(v.estado === 'en curso' || v.estado === 'pendiente') && (
                                                            <>
                                                                <button className="btn btn-success" onClick={() => openFinalizarModal(v.id)} title="Finalizar viaje">
                                                                    <i className="bi bi-check-circle"></i>
                                                                </button>
                                                                {v.estado === 'en curso' && (
                                                                    <button className="btn btn-danger" onClick={async () => {
                                                                        if (!confirm('¿Liberar este viaje? Volverá a pendientes.')) return;
                                                                        try {
                                                                            await api.patch(`/viajes/${v.id}/liberar`);
                                                                            showToast('Viaje liberado', 'success');
                                                                            await fetchViajes();
                                                                        } catch (e) {
                                                                            const msg = e?.response?.data?.error || 'Error liberando viaje';
                                                                            setError(msg);
                                                                            showToast(msg, 'error');
                                                                        }
                                                                    }}>Liberar</button>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                        <div className="d-flex justify-content-between align-items-center mt-2">
                            <small className="text-body-secondary">Mostrando {(viajesPagina.length && (currentPage - 1) * pageSize + 1) || 0} - {(currentPage - 1) * pageSize + viajesPagina.length} de {viajesFiltrados.length}</small>
                            <div className="btn-group btn-group-sm" role="group">
                                <button className="btn btn-outline-secondary" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</button>
                                <button className="btn btn-outline-secondary" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Siguiente</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row g-3">
                    <div className="col-lg-6">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Reporte</h3>
                                {/* Gráficos rápidos */}
                                <div className="row g-3 mt-1 align-items-stretch">
                                    <div className="col-sm-6">
                                        <div className="border rounded p-3 h-100">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <strong>Por estado</strong>
                                                <span className="text-body-secondary small">Total: {estadoChart.total}</span>
                                            </div>
                                            <div className="d-flex align-items-center gap-3">
                                                <div style={{ width: 140, height: 140, borderRadius: '50%', background: estadoChart.bg, position: 'relative' }}>
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ width: '70%', height: '70%', borderRadius: '50%', background: 'var(--bs-body-bg)', boxShadow: 'inset 0 0 0 1px var(--bs-border-color)' }}></div>
                                                    </div>
                                                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                                        <div className="text-center">
                                                            <div className="fw-bold">{estadoChart.total}</div>
                                                            <div className="text-body-secondary small">viajes</div>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex-grow-1">
                                                    {estadoChart.items.map(it => (
                                                        <div key={it.label} className="d-flex align-items-center justify-content-between mb-1">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <span style={{ width: 10, height: 10, borderRadius: 999, background: it.color, display: 'inline-block' }}></span>
                                                                <span className="text-capitalize">{it.label}</span>
                                                            </div>
                                                            <span className="text-body-secondary">{it.value}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="col-sm-6">
                                        <div className="border rounded p-3 h-100">
                                            <strong className="d-block mb-2">Top camioneros</strong>
                                            {porCamioneroTop.length === 0 ? (
                                                <div className="text-body-secondary small">Sin datos</div>
                                            ) : porCamioneroTop.map((it, i) => {
                                                const max = porCamioneroTop[0].value || 1;
                                                const w = Math.max(6, Math.round((it.value / max) * 100));
                                                return (
                                                    <div key={it.label} className="mb-2">
                                                        <div className="d-flex justify-content-between"><span className="text-truncate" style={{ maxWidth: '70%' }}>{i + 1}. {it.label}</span><span className="text-body-secondary">{it.value}</span></div>
                                                        <div className="progress" role="progressbar" aria-valuenow={w} aria-valuemin="0" aria-valuemax="100" style={{ height: 8 }}>
                                                            <div className="progress-bar bg-primary" style={{ width: `${w}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <div className="border rounded p-3">
                                            <strong className="d-block mb-2">Top camiones</strong>
                                            {porCamionTop.length === 0 ? (
                                                <div className="text-body-secondary small">Sin datos</div>
                                            ) : porCamionTop.map((it, i) => {
                                                const max = porCamionTop[0].value || 1;
                                                const w = Math.max(6, Math.round((it.value / max) * 100));
                                                return (
                                                    <div key={it.label} className="mb-2">
                                                        <div className="d-flex justify-content-between"><span className="text-truncate" style={{ maxWidth: '70%' }}>{i + 1}. {it.label}</span><span className="text-body-secondary">{it.value}</span></div>
                                                        <div className="progress" role="progressbar" aria-valuenow={w} aria-valuemin="0" aria-valuemax="100" style={{ height: 8 }}>
                                                            <div className="progress-bar bg-success" style={{ width: `${w}%` }}></div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                                <div className="row g-2 mt-1">
                                    <div className="col-12 col-sm-6">
                                        <div className="p-3 rounded border bg-body-tertiary">Total viajes: <strong>{reporte.total}</strong></div>
                                    </div>
                                    <div className="col-12 col-sm-6">
                                        <div className="p-3 rounded border bg-body-tertiary">Km totales: <strong>{reporte.km}</strong></div>
                                    </div>
                                    <div className="col-12">
                                        <div className="p-3 rounded border bg-body-tertiary">Combustible total: <strong>{reporte.combustible}</strong></div>
                                    </div>
                                    <div className="col-12">
                                        <div className="p-3 rounded border bg-body-tertiary">Por estado: {Object.entries(reporte.porEstado).map(([k, v]) => `${k}: ${v}`).join(' • ') || '-'}</div>
                                    </div>
                                    <div className="col-12">
                                        <h4 className="h6 mt-2">Por camionero</h4>
                                        <div className="table-responsive">
                                            <table className={`table table-sm align-middle mb-0 table-cols-bordered`}>
                                                <thead><tr><th>Camionero</th><th className="text-end">Viajes</th><th className="text-end">Km</th><th className="text-end">Combustible</th></tr></thead>
                                                <tbody>
                                                    {Object.entries(viajes.reduce((acc, v) => {
                                                        const key = v.camionero?.nombre || '-';
                                                        acc[key] = acc[key] || { c: 0, km: 0, comb: 0 };
                                                        acc[key].c += 1;
                                                        acc[key].km += Number(v.km) || 0;
                                                        acc[key].comb += Number(v.combustible) || 0;
                                                        return acc;
                                                    }, {})).map(([nombre, s]) => (
                                                        <tr key={nombre}><td>{nombre}</td><td className="text-end">{s.c}</td><td className="text-end">{s.km}</td><td className="text-end">{s.comb}</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                    <div className="col-12">
                                        <h4 className="h6 mt-2">Por camión</h4>
                                        <div className="table-responsive">
                                            <table className={`table table-sm align-middle mb-0 table-cols-bordered`}>
                                                <thead><tr><th>Camión</th><th className="text-end">Viajes</th><th className="text-end">Km</th><th className="text-end">Combustible</th></tr></thead>
                                                <tbody>
                                                    {Object.entries(viajes.reduce((acc, v) => {
                                                        const key = v.camion ? `${v.camion.patente} (${v.camion.marca})` : v.camionId;
                                                        acc[key] = acc[key] || { c: 0, km: 0, comb: 0 };
                                                        acc[key].c += 1;
                                                        acc[key].km += Number(v.km) || 0;
                                                        acc[key].comb += Number(v.combustible) || 0;
                                                        return acc;
                                                    }, {})).map(([patente, s]) => (
                                                        <tr key={patente}><td>{patente}</td><td className="text-end">{s.c}</td><td className="text-end">{s.km}</td><td className="text-end">{s.comb}</td></tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="col-lg-6">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Usuarios</h3>
                                <form onSubmit={crearUsuario} className="row g-2 mt-2" style={{ opacity: savingUsuario ? 0.85 : 1 }}>
                                    <div className="col-6"><input className="form-control" placeholder="Nombre" value={nuevoUsuario.nombre} onChange={e => setNuevoUsuario(v => ({ ...v, nombre: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" placeholder="Email" value={nuevoUsuario.email} onChange={e => setNuevoUsuario(v => ({ ...v, email: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" type="password" placeholder="Password" value={nuevoUsuario.password} onChange={e => setNuevoUsuario(v => ({ ...v, password: e.target.value }))} /></div>
                                    <div className="col-6"></div>
                                    <div className="col-6">
                                        <select className="form-select" value={nuevoUsuario.rol} onChange={e => setNuevoUsuario(v => ({ ...v, rol: e.target.value }))}>
                                            <option value="camionero">Camionero</option>
                                            <option value="administracion">Administración</option>
                                            <option value="ceo">CEO</option>
                                        </select>
                                    </div>
                                    <div className="col-12"><button className="btn btn-primary" disabled={savingUsuario}>{savingUsuario ? 'Creando…' : 'Crear usuario'}</button></div>
                                </form>
                                <div className="table-responsive mt-3">
                                    {usuarios.length === 0 ? (
                                        <EmptyState title="Sin usuarios" description="Todavía no cargaste usuarios" />
                                    ) : (
                                        <table className={`table table-sm table-hover align-middle mb-0 table-sticky table-cols-bordered`}>
                                            <thead>
                                                <tr>
                                                    {['Nombre', 'Email', 'Rol'].map(label => (
                                                        <th key={label} className="text-uppercase small" style={{ verticalAlign: 'middle', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>
                                                            <div className="d-inline-flex align-items-center gap-1"><span>{label}</span></div>
                                                        </th>
                                                    ))}
                                                    <th className="text-end text-uppercase small" style={{ minWidth: 160, verticalAlign: 'middle', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usuarios.map(u => (
                                                    <tr key={u.id} className={savedUsuarioId === u.id ? 'table-success row-saved-anim' : ''}>
                                                        <td>
                                                            {editUsuarioId === u.id ? (
                                                                <input className="form-control form-control-sm" value={editUsuarioData.nombre} onChange={e => setEditUsuarioData(v => ({ ...v, nombre: e.target.value }))} />
                                                            ) : u.nombre}
                                                        </td>
                                                        <td>
                                                            {editUsuarioId === u.id ? (
                                                                <input className="form-control form-control-sm" value={editUsuarioData.email} onChange={e => setEditUsuarioData(v => ({ ...v, email: e.target.value }))} />
                                                            ) : u.email}
                                                        </td>
                                                        <td style={{ maxWidth: 160 }}>
                                                            {editUsuarioId === u.id ? (
                                                                u.rol === 'ceo' ? (
                                                                    <span className={`badge badge-role-ceo`}>ceo</span>
                                                                ) : (
                                                                    <select className="form-select form-select-sm" value={editUsuarioData.rol} onChange={e => setEditUsuarioData(v => ({ ...v, rol: e.target.value }))}>
                                                                        <option value="camionero">Camionero</option>
                                                                        <option value="administracion">Administración</option>
                                                                        <option value="ceo">CEO</option>
                                                                    </select>
                                                                )
                                                            ) : (
                                                                <span className={`badge ${u.rol === 'ceo' ? 'badge-role-ceo' : u.rol === 'administracion' ? 'badge-role-administracion' : 'badge-role-camionero'}`}>{u.rol}</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            {editUsuarioId === u.id ? (
                                                                <div className="d-flex gap-2 justify-content-end align-items-center flex-wrap">
                                                                    {!editUsuarioData.changePassword ? (
                                                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditUsuarioData(v => ({ ...v, changePassword: true, password: '', showPassword: false }))} title="Cambiar contraseña">
                                                                            <i className="bi bi-key me-1"></i> Cambiar contraseña
                                                                        </button>
                                                                    ) : (
                                                                        <div className="d-flex gap-2 align-items-center">
                                                                            <input
                                                                                className="form-control form-control-sm"
                                                                                style={{ maxWidth: 220 }}
                                                                                type={editUsuarioData.showPassword ? 'text' : 'password'}
                                                                                placeholder="Nuevo password (opcional)"
                                                                                value={editUsuarioData.password}
                                                                                onChange={e => setEditUsuarioData(v => ({ ...v, password: e.target.value }))}
                                                                            />
                                                                            <button
                                                                                className="btn btn-sm btn-outline-warning"
                                                                                onClick={() => setEditUsuarioData(v => ({ ...v, showPassword: !v.showPassword }))}
                                                                                title={editUsuarioData.showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                                                                            >
                                                                                <i className={`bi ${editUsuarioData.showPassword ? 'bi-eye-slash' : 'bi-eye'}`}></i>
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                    <div className="btn-group btn-group-sm">
                                                                        <button className="btn btn-success" onClick={() => saveEditUsuario(u.id)} title="Guardar"><i className="bi bi-check-lg"></i></button>
                                                                        <button className="btn btn-outline-secondary" onClick={cancelEditUsuario} title="Cancelar"><i className="bi bi-x-lg"></i></button>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="btn-group btn-group-sm">
                                                                    <button className="btn btn-outline-primary" onClick={() => startEditUsuario(u)} title="Editar"><i className="bi bi-pencil"></i></button>
                                                                    <button className="btn btn-outline-danger" onClick={() => deleteUsuario(u.id)} title="Eliminar"><i className="bi bi-trash"></i></button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div >
            {/* Gráficos del CEO */}
            <div className="mb-3">
                <div className="card shadow-sm mb-2">
                    <div className="card-body d-flex flex-wrap align-items-end gap-2">
                        <div>
                            <label className="form-label mb-1">Desde</label>
                            <input type="date" className="form-control" value={chartFrom} onChange={e => setChartFrom(e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label mb-1">Hasta</label>
                            <input type="date" className="form-control" value={chartTo} onChange={e => setChartTo(e.target.value)} />
                        </div>
                        <div>
                            <label className="form-label mb-1">Cliente</label>
                            <select className="form-select" value={chartCliente} onChange={e => setChartCliente(e.target.value)}>
                                <option value="">Todos</option>
                                {clientesOpciones.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="form-label mb-1">Tipo</label>
                            <select className="form-select" value={chartTipo} onChange={e => setChartTipo(e.target.value)}>
                                <option value="">Todos</option>
                                {tiposOpciones.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <button className="btn btn-outline-secondary ms-auto" onClick={() => { setChartFrom(''); setChartTo(''); setChartCliente(''); setChartTipo(''); }}>Limpiar</button>
                    </div>
                </div>
                <DashboardCharts viajes={viajesFinalizados} filtros={{ from: chartFrom, to: chartTo, cliente: chartCliente, tipo: chartTipo }} />
            </div>
            {/* Modal detalle viaje */}
            <div className={`modal ${showDetalleModal ? 'show d-block' : 'fade'}`} id="modalDetalleViaje" tabIndex="-1" aria-hidden={!showDetalleModal}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">Detalle de viaje</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={() => setShowDetalleModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            {detalleLoading && <div className="text-center py-3"><span className="spinner-border"></span></div>}
                            {detalle && (
                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <div><strong>Fecha:</strong> {formatDateOnly(detalle.fecha)}</div>
                                        <div><strong>Estado:</strong> <span className={`badge badge-dot ${detalle.estado === 'finalizado' ? 'badge-estado-finalizado' : detalle.estado === 'en curso' ? 'badge-estado-en_curso' : 'badge-estado-pendiente'} text-capitalize`}>{detalle.estado}</span></div>
                                        <div><strong>Origen:</strong> {detalle.origen}</div>
                                        <div><strong>Destino:</strong> {detalle.destino}</div>
                                        <div>
                                            <strong>Factura:</strong>{' '}
                                            {detalle.facturaUrl ? (
                                                <a href={(() => { try { const base = api?.defaults?.baseURL || window.location.origin; return new URL(detalle.facturaUrl, base).toString(); } catch { return detalle.facturaUrl; } })()} target="_blank" rel="noreferrer">
                                                    Ver factura
                                                </a>
                                            ) : (
                                                <span className="text-body-secondary">No subida</span>
                                            )}
                                        </div>
                                        <div><strong>Estado factura:</strong> {detalle.facturaEstado || '-'}</div>
                                        <div><strong>Fecha factura:</strong> {detalle.fechaFactura ? formatDateOnly(detalle.fechaFactura) : '-'}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <div><strong>Camión:</strong> {detalle.camion ? `${detalle.camion.patente} (${detalle.camion.marca} ${detalle.camion.modelo}, ${detalle.camion.anio})` : detalle.camionId}</div>
                                        <div><strong>Acoplado:</strong> {detalle.acoplado ? detalle.acoplado.patente : (detalle.acopladoPatente || '-')}</div>
                                        <div><strong>Camionero:</strong> {detalle.camionero?.nombre || '-'}</div>
                                        <div><strong>Tipo mercadería:</strong> {detalle.tipoMercaderia ?? '-'}</div>
                                        <div><strong>Cliente:</strong> {detalle.cliente ?? '-'}</div>
                                        <div><strong>Kilómetros:</strong> {detalle.km ?? '-'}</div>
                                        <div><strong>Combustible:</strong> {detalle.combustible ?? '-'}</div>
                                        <div><strong>Kilos cargados:</strong> {detalle.kilosCargados ?? '-'}</div>
                                        <div><strong>Precio por tonelada:</strong> {detalle.precioTonelada ?? '-'}</div>
                                        <div><strong>Importe:</strong> {detalle.importe ?? '-'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            {detalle && (
                                <>
                                    <div className="d-flex gap-2 align-items-center mb-2">
                                        <button
                                            type="button"
                                            className="btn btn-outline-secondary"
                                            onClick={() => generarDetalleViajePDF(detalle)}
                                            disabled={!(detalle.facturaUrl && detalle.facturaEstado === 'cobrada')}
                                            title={!(detalle.facturaUrl && detalle.facturaEstado === 'cobrada') ? 'Acción no disponible hasta subir y confirmar la factura.' : 'Descarga el PDF de detalle'}
                                        >
                                            <i className="bi bi-file-earmark-pdf me-1"></i> PDF Detalle
                                        </button>
                                        {detalle.estado === 'finalizado' && (
                                            <button
                                                type="button"
                                                className="btn btn-outline-success"
                                                onClick={() => generarFacturaViajePDF(detalle)}
                                                disabled={!(detalle.facturaUrl && detalle.facturaEstado === 'cobrada')}
                                                title={!(detalle.facturaUrl && detalle.facturaEstado === 'cobrada') ? 'Acción no disponible hasta subir y confirmar la factura.' : 'Descarga el PDF de la factura'}
                                            >
                                                <i className="bi bi-receipt me-1"></i> Factura PDF
                                            </button>
                                        )}
                                        {!(detalle.facturaUrl && detalle.facturaEstado === 'cobrada') && (
                                            <span className="text-danger ms-2 d-flex align-items-center">
                                                <i className="bi bi-exclamation-triangle me-1"></i>
                                                Para descargar el PDF, primero sube y confirma la factura como cobrada.
                                            </span>
                                        )}
                                    </div>
                                </>
                            )}
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={() => setShowDetalleModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
            {showDetalleModal && <div className="modal-backdrop show"></div>}

            {/* Modal editar viaje */}
            <div className={`modal ${editViajeModal.open ? 'show d-block' : 'fade'}`} id="modalEditarViaje" tabIndex="-1" aria-hidden={!editViajeModal.open}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Editar viaje #{editViajeModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={closeEditViaje}></button>
                        </div>
                        <div className="modal-body">
                            {editViajeModal.error && <div className="alert alert-danger">{editViajeModal.error}</div>}
                            <div className="row g-2">
                                <div className="col-6"><label className="form-label">Origen</label><input className="form-control" value={editViajeModal.data.origen} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, origen: e.target.value } }))} /></div>
                                <div className="col-6"><label className="form-label">Destino</label><input className="form-control" value={editViajeModal.data.destino} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, destino: e.target.value } }))} /></div>
                                <div className="col-6"><label className="form-label">Fecha</label><input className="form-control" type="date" value={editViajeModal.data.fecha} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, fecha: e.target.value } }))} /></div>
                                <div className="col-6"><label className="form-label">Camión</label>
                                    <select className="form-select" value={editViajeModal.data.camionId} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, camionId: e.target.value } }))}>
                                        <option value="">Seleccioná camión</option>
                                        {camiones.map(c => <option key={c.id} value={c.id}>{c.patente}</option>)}
                                    </select>
                                </div>
                                <div className="col-6"><label className="form-label">Acoplado</label>
                                    <select className="form-select" value={editViajeModal.data.acopladoId || ''} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, acopladoId: e.target.value } }))}>
                                        <option value="">Sin acoplado</option>
                                        {acoplados.map(a => <option key={a.id} value={a.id}>{a.patente}</option>)}
                                    </select>
                                </div>
                                <div className="col-6"><label className="form-label">Tipo mercadería</label><input className="form-control" value={editViajeModal.data.tipoMercaderia} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, tipoMercaderia: e.target.value } }))} /></div>
                                <div className="col-6"><label className="form-label">Cliente</label><input className="form-control" value={editViajeModal.data.cliente} onChange={e => setEditViajeModal(m => ({ ...m, data: { ...m.data, cliente: e.target.value } }))} /></div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={closeEditViaje} disabled={editViajeModal.loading}>Cancelar</button>
                            <button className="btn btn-primary" onClick={saveEditViaje} disabled={editViajeModal.loading}>{editViajeModal.loading ? <span className="spinner-border spinner-border-sm" role="status" /> : 'Guardar'}</button>
                        </div>
                    </div>
                </div>
            </div>
            {editViajeModal.open && <div className="modal-backdrop show"></div>}

            {/* Modal Finalizar Viaje (CEO) */}
            <div className={`modal ${showFinalizarModal ? 'show d-block' : 'fade'}`} id="modalFinalizarCeo" tabIndex="-1" aria-hidden={!showFinalizarModal}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">Finalizar viaje</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" onClick={() => setShowFinalizarModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            {modalFinalizarId && (() => {
                                const viajeSeleccionado = viajes.find(v => v.id === modalFinalizarId);
                                if (!viajeSeleccionado) return null;
                                return (
                                    <>
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
                                                    <div><strong>Combustible (actual):</strong> {viajeSeleccionado.combustible ?? '-'}</div>
                                                    <div><strong>Kilos cargados:</strong> {viajeSeleccionado.kilosCargados ?? '-'}</div>
                                                </div>
                                            </div>
                                            <hr />
                                        </div>
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
                                                    <label className="form-label">Kilos cargados</label>
                                                    <input className="form-control" type="number" min={0} step={1} value={finalizarData.kilosCargados} onChange={e => setFinalizarData(x => ({ ...x, kilosCargados: e.target.value }))} />
                                                    <small className="text-body-secondary">Si definiste precio por tonelada, se calculará automáticamente el importe del viaje.</small>
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
                                                    <li><strong>Kilos a registrar:</strong> {finalizarData.kilosCargados || '—'}</li>
                                                </ul>
                                                <div className="alert alert-danger py-2 small mb-2">
                                                    Una vez finalizado el viaje, no podrás volverlo a "en curso".
                                                </div>
                                                <div className="form-check mb-0">
                                                    <input className="form-check-input" type="checkbox" id="chkConfirmFinalizarCeo"
                                                        checked={confirmChecked}
                                                        onChange={(e) => setConfirmChecked(e.target.checked)} />
                                                    <label className="form-check-label small" htmlFor="chkConfirmFinalizarCeo">Entiendo que esta acción es definitiva y confirmo finalizar el viaje</label>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>
                        <div className="modal-footer">
                            {!finalizarPasoConfirm ? (
                                <>
                                    <button type="button" className="btn btn-secondary" data-bs-dismiss="modal" onClick={() => setShowFinalizarModal(false)}>Cerrar</button>
                                    <button type="button" className="btn btn-primary" disabled={!modalFinalizarId || Number(finalizarData.km) <= 0 || Number(finalizarData.combustible) <= 0} onClick={() => modalFinalizarId && finalizarViaje(modalFinalizarId)}>
                                        Continuar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setFinalizarPasoConfirm(false)} disabled={finishingId === modalFinalizarId}>Volver</button>
                                    <button type="button" className="btn btn-danger" disabled={!modalFinalizarId || finishingId === modalFinalizarId || !confirmChecked || Number(finalizarData.km) <= 0 || Number(finalizarData.combustible) <= 0} onClick={() => modalFinalizarId && finalizarViaje(modalFinalizarId)}>
                                        {finishingId === modalFinalizarId ? 'Finalizando…' : 'Finalizar viaje'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showFinalizarModal && <div className="modal-backdrop show"></div>}
        </>
    );
}

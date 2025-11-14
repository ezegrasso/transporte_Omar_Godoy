import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import UserMenu from '../components/UserMenu';
import EmptyState from '../components/UI/EmptyState';
import { useToast } from '../context/ToastContext';
import { downloadCSV } from '../utils/csv';

export default function Admin() {
    const [camiones, setCamiones] = useState([]);
    const [viajes, setViajes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [nuevoCamion, setNuevoCamion] = useState({ patente: '', marca: '', modelo: '', anio: '' });
    const [camionErrors, setCamionErrors] = useState({});
    const [nuevoViaje, setNuevoViaje] = useState({ origen: '', destino: '', fecha: '', camionId: '', tipoMercaderia: '', cliente: '' });
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', password: '', rol: 'camionero' });
    const [savingCamion, setSavingCamion] = useState(false);
    const [savingViaje, setSavingViaje] = useState(false);
    const [savingUsuario, setSavingUsuario] = useState(false);
    const { showToast } = useToast();
    const [filtroEstado, setFiltroEstado] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [sortKey, setSortKey] = useState('fecha');
    const [sortDir, setSortDir] = useState('desc'); // 'asc' | 'desc'
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const [density, setDensity] = useState(() => localStorage.getItem('tableDensity') || 'comfortable');
    const compact = density === 'compact';
    useEffect(() => { localStorage.setItem('tableDensity', density) }, [density]);

    // Detalle de viaje
    const [detalle, setDetalle] = useState(null);
    const [detalleLoading, setDetalleLoading] = useState(false);
    const abrirDetalle = async (id) => {
        setDetalle(null);
        setDetalleLoading(true);
        try {
            const { data } = await api.get(`/api/viajes/${id}`);
            setDetalle(data);
            // abrir modal
            setTimeout(() => {
                try {
                    const el = document.getElementById('modalDetalleViaje');
                    if (el && window.bootstrap?.Modal) {
                        const modal = window.bootstrap.Modal.getOrCreateInstance(el);
                        modal.show();
                    }
                } catch { }
            }, 10);
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error cargando detalle';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setDetalleLoading(false);
        }
    };

    const fetchCamiones = async () => {
        const { data } = await api.get('/api/camiones?limit=100');
        const list = (data.items || data.data || []);
        setCamiones(list);
        return list;
    };
    const fetchViajes = async () => {
        const { data } = await api.get('/api/viajes?limit=100');
        const list = data.items || data.data || [];
        setViajes(list);
        return list;
    };
    const fetchUsuarios = async () => {
        const { data } = await api.get('/api/usuarios');
        const list = Array.isArray(data) ? data : (data.items || []);
        setUsuarios(list);
        return list;
    };

    // Utilidad: descargar CSV simple
    const downloadCSV = (filename, headers, rows) => {
        try {
            const csvRows = [];
            if (headers && headers.length) csvRows.push(headers.map(h => `"${String(h).replaceAll('"', '""')}"`).join(','));
            (rows || []).forEach(r => {
                csvRows.push(r.map(v => `"${String(v ?? '').replaceAll('"', '""')}"`).join(','));
            });
            const csvContent = csvRows.join('\r\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Error exportando CSV', e);
        }
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

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try { await Promise.all([fetchCamiones(), fetchViajes(), fetchUsuarios()]); }
            catch (e) { setError(e?.response?.data?.error || 'Error cargando datos'); }
            finally { setLoading(false); }
        })();
    }, []);

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
            const { data: created } = await api.post('/api/camiones', body);
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
                tipoMercaderia: nuevoViaje.tipoMercaderia?.trim() || null,
                cliente: nuevoViaje.cliente?.trim() || null
            };
            await api.post('/api/viajes', body);
            setNuevoViaje({ origen: '', destino: '', fecha: '', camionId: '', tipoMercaderia: '', cliente: '' });
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
            const { data: created } = await api.post('/api/usuarios', nuevoUsuario);
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
        return viajes.filter(v => {
            const okEstado = !filtroEstado || v.estado === filtroEstado;
            const text = `${v.origen ?? ''} ${v.destino ?? ''} ${v.tipoMercaderia ?? ''} ${v.cliente ?? ''} ${v.camion?.patente ?? v.camionId ?? ''} ${v.camionero?.nombre ?? ''}`.toLowerCase();
            const okTexto = !term || text.includes(term);
            const okCamion = !filtroCamion || (v.camion?.patente || v.camionId || '') === filtroCamion;
            const okCamionero = !filtroCamionero || (v.camionero?.nombre || '') === filtroCamionero;
            const okTipo = !filtroTipo || (v.tipoMercaderia || '') === filtroTipo;
            const okCliente = !filtroCliente || (v.cliente || '') === filtroCliente;
            return okEstado && okTexto && okCamion && okCamionero && okTipo && okCliente;
        });
    }, [viajes, filtroEstado, busqueda, filtroCamion, filtroCamionero, filtroTipo, filtroCliente]);

    const viajesOrdenados = useMemo(() => {
        const arr = [...viajesFiltrados];
        const dir = sortDir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            const getVal = (v, k) => {
                switch (k) {
                    case 'fecha': return new Date(v.fecha || 0).getTime();
                    case 'origen': return (v.origen || '').toLowerCase();
                    case 'destino': return (v.destino || '').toLowerCase();
                    case 'estado': return (v.estado || '').toLowerCase();
                    case 'camion': return ((v.camion?.patente || v.camionId || '') + '').toString().toLowerCase();
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

    const exportViajes = (scope = 'filtro') => {
        const set = scope === 'pagina' ? viajesPagina : viajesOrdenados;
        const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Camionero', 'Tipo', 'Cliente', 'Km', 'Combustible'];
        const rows = set.map(v => [
            new Date(v.fecha).toLocaleDateString(),
            v.estado || '',
            v.origen || '',
            v.destino || '',
            v.camion?.patente || v.camionId || '',
            v.camionero?.nombre || '',
            v.tipoMercaderia || '',
            v.cliente || '',
            v.km ?? '',
            v.combustible ?? ''
        ]);
        downloadCSV(`viajes_${scope}.csv`, headers, rows);
        showToast(`Exportado CSV (${scope})`, 'success');
    };

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
            await api.put(`/api/camiones/${id}`, body);
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
        if (!confirm('¿Eliminar camión? Esta acción no se puede deshacer.')) return;
        try {
            await api.delete(`/api/camiones/${id}`);
            showToast('Camión eliminado', 'success');
            await fetchCamiones();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error eliminando camión';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    // Edición inline de usuarios
    const [editUsuarioId, setEditUsuarioId] = useState(null);
    const [editUsuarioData, setEditUsuarioData] = useState({ nombre: '', email: '', rol: 'camionero', password: '', changePassword: false });
    const [savedUsuarioId, setSavedUsuarioId] = useState(null);

    const startEditUsuario = (u) => {
        setEditUsuarioId(u.id);
        setEditUsuarioData({ nombre: u.nombre || '', email: u.email || '', rol: u.rol || 'camionero', password: '', changePassword: false });
    };
    const cancelEditUsuario = () => { setEditUsuarioId(null); };
    const saveEditUsuario = async (id) => {
        try {
            const body = { nombre: editUsuarioData.nombre, email: editUsuarioData.email, rol: editUsuarioData.rol };
            if (editUsuarioData.changePassword && editUsuarioData.password && editUsuarioData.password.trim().length > 0) {
                body.password = editUsuarioData.password.trim();
            }
            await api.put(`/api/usuarios/${id}`, body);
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
            await api.delete(`/api/usuarios/${id}`);
            showToast('Usuario eliminado', 'success');
            await fetchUsuarios();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error eliminando usuario';
            setError(msg);
            showToast(msg, 'error');
        }
    };

    return (
        <>
            <div className="container py-3 space-y-4">
                <PageHeader title="Panel Admin" subtitle="Gestión de camiones, viajes y usuarios" actions={loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" />} />

                {/* KPIs rápidos */}
                <div className="row g-3 mb-2">
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">Viajes</div>
                                <div className="fs-4 fw-bold">{reporte.total}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">En curso</div>
                                <div className="fs-4 fw-bold">{viajes.filter(v => v.estado === 'en curso').length}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100">
                            <div className="card-body py-3">
                                <div className="text-body-secondary small text-uppercase">Finalizados</div>
                                <div className="fs-4 fw-bold">{viajes.filter(v => v.estado === 'finalizado').length}</div>
                            </div>
                        </div>
                    </div>
                    <div className="col-6 col-md-3">
                        <div className="card shadow-sm h-100">
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
                                        <table className={`table ${compact ? 'table-sm' : ''} table-hover align-middle mb-0 table-sticky`}>
                                            <thead>
                                                <tr><th>Patente</th><th>Marca</th><th>Modelo</th><th>Año</th><th className="text-end">Acciones</th></tr>
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
                                    <div className="col-6">
                                        <select className="form-select" value={nuevoViaje.camionId} onChange={e => setNuevoViaje(v => ({ ...v, camionId: e.target.value }))}>
                                            <option value="">Seleccioná camión</option>
                                            {camiones.map(c => <option key={c.id} value={c.id}>{c.patente}</option>)}
                                        </select>
                                    </div>
                                    <div className="col-12"><button className="btn btn-primary" disabled={savingViaje}>{savingViaje ? 'Guardando…' : 'Guardar'}</button></div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card shadow-sm">
                    <div className="card-body">
                        <div className="d-flex flex-wrap gap-2 align-items-end mb-2">
                            <h3 className="h5 mb-0 me-auto">Viajes</h3>
                            <div className="form-check form-switch d-flex align-items-center gap-2">
                                <input className="form-check-input" type="checkbox" role="switch" id="switchDensityAdmin" checked={compact} onChange={e => setDensity(e.target.checked ? 'compact' : 'comfortable')} />
                                <label className="form-check-label" htmlFor="switchDensityAdmin">Compacto</label>
                            </div>
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
                                <select className="form-select form-select-sm" value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }}>
                                    <option value="">Todos</option>
                                    {tiposOpciones.map(t => (
                                        <option key={t} value={t}>{t}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label mb-1">Cliente</label>
                                <select className="form-select form-select-sm" value={filtroCliente} onChange={e => { setFiltroCliente(e.target.value); setPage(1); }}>
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
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => exportViajes('filtro')} title="Exportar viajes filtrados">
                                <i className="bi bi-filetype-csv me-1"></i> Exportar (filtro)
                            </button>
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => exportViajes('pagina')} title="Exportar viajes de esta página">
                                <i className="bi bi-file-earmark-spreadsheet me-1"></i> Exportar (página)
                            </button>
                        </div>
                        <div className="table-responsive">
                            {viajesFiltrados.length === 0 ? (
                                <EmptyState title="Sin viajes" description="No hay viajes que coincidan con el filtro" />
                            ) : (
                                <table className={`table ${compact ? 'table-sm' : ''} table-striped table-hover table-sticky`}>
                                    <thead>
                                        <tr>
                                            {['fecha', 'estado', 'origen', 'destino', 'camion', 'camionero', 'tipo', 'cliente', 'km', 'combustible'].map((k) => (
                                                <th key={k} role="button" onClick={() => {
                                                    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                                    else { setSortKey(k); setSortDir('asc'); }
                                                }}>
                                                    <span className="me-1 text-capitalize">{k}</span>
                                                    {sortKey === k ? (
                                                        <i className={`bi ${sortDir === 'asc' ? 'bi-sort-up' : 'bi-sort-down'}`}></i>
                                                    ) : (
                                                        <i className="bi bi-arrow-down-up opacity-75"></i>
                                                    )}
                                                </th>
                                            ))}
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {viajesPagina.map(v => (
                                            <tr key={v.id}>
                                                <td>{new Date(v.fecha).toLocaleDateString()}</td>
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
                                                <td title={v.camionero?.nombre || '-'} data-bs-toggle="tooltip">{v.camionero?.nombre || '-'}</td>
                                                <td title={v.tipoMercaderia || '-'} data-bs-toggle="tooltip">{v.tipoMercaderia || '-'}</td>
                                                <td title={v.cliente || '-'} data-bs-toggle="tooltip">{v.cliente || '-'}</td>
                                                <td className="text-end">{v.km ?? '-'}</td>
                                                <td className="text-end">{v.combustible ?? '-'}</td>
                                                <td className="text-end" style={{ width: 180 }}>
                                                    <div className="btn-group btn-group-sm">
                                                        <button className="btn btn-outline-secondary" onClick={() => abrirDetalle(v.id)} title="Ver detalle">
                                                            <i className="bi bi-eye"></i>
                                                        </button>
                                                        {v.estado === 'en curso' && (
                                                            <button className="btn btn-danger" onClick={async () => {
                                                                if (!confirm('¿Liberar este viaje? Volverá a pendientes.')) return;
                                                                try {
                                                                    await api.patch(`/api/viajes/${v.id}/liberar`);
                                                                    showToast('Viaje liberado', 'success');
                                                                    await fetchViajes();
                                                                } catch (e) {
                                                                    const msg = e?.response?.data?.error || 'Error liberando viaje';
                                                                    setError(msg);
                                                                    showToast(msg, 'error');
                                                                }
                                                            }}>Liberar</button>
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
                                    {/* Resumenes adicionales */}
                                    <div className="col-12">
                                        <h4 className="h6 mt-2">Por camionero</h4>
                                        <div className="table-responsive">
                                            <table className={`table ${compact ? 'table-sm' : ''} align-middle mb-0`}>
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
                                            <table className={`table ${compact ? 'table-sm' : ''} align-middle mb-0`}>
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
                                    <div className="col-6">
                                        <select className="form-select" value={nuevoUsuario.rol} onChange={e => setNuevoUsuario(v => ({ ...v, rol: e.target.value }))}>
                                            <option value="camionero">Camionero</option>
                                            <option value="admin">Admin</option>
                                        </select>
                                    </div>
                                    <div className="col-12"><button className="btn btn-primary" disabled={savingUsuario}>{savingUsuario ? 'Creando…' : 'Crear usuario'}</button></div>
                                </form>
                                <div className="table-responsive mt-3">
                                    {usuarios.length === 0 ? (
                                        <EmptyState title="Sin usuarios" description="Todavía no cargaste usuarios" />
                                    ) : (
                                        <table className={`table ${compact ? 'table-sm' : ''} table-hover align-middle mb-0 table-sticky`}>
                                            <thead>
                                                <tr><th>Nombre</th><th>Email</th><th>Rol</th><th style={{ minWidth: 160 }} className="text-end">Acciones</th></tr>
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
                                                                <select className="form-select form-select-sm" value={editUsuarioData.rol} onChange={e => setEditUsuarioData(v => ({ ...v, rol: e.target.value }))}>
                                                                    <option value="camionero">Camionero</option>
                                                                    <option value="admin">Admin</option>
                                                                </select>
                                                            ) : (
                                                                <span className={`badge ${u.rol === 'admin' ? 'badge-role-admin' : 'badge-role-camionero'}`}>{u.rol}</span>
                                                            )}
                                                        </td>
                                                        <td className="text-end">
                                                            {editUsuarioId === u.id ? (
                                                                <div className="d-flex gap-2 justify-content-end align-items-center flex-wrap">
                                                                    {!editUsuarioData.changePassword ? (
                                                                        <button className="btn btn-sm btn-outline-secondary" onClick={() => setEditUsuarioData(v => ({ ...v, changePassword: true, password: '' }))} title="Cambiar contraseña">
                                                                            <i className="bi bi-key me-1"></i> Cambiar contraseña
                                                                        </button>
                                                                    ) : (
                                                                        <div className="d-flex gap-2 align-items-center">
                                                                            <input className="form-control form-control-sm" style={{ maxWidth: 220 }} type="password" placeholder="Nuevo password (opcional)" value={editUsuarioData.password} onChange={e => setEditUsuarioData(v => ({ ...v, password: e.target.value }))} />
                                                                            <button className="btn btn-sm btn-outline-warning" onClick={() => setEditUsuarioData(v => ({ ...v, changePassword: false, password: '' }))} title="Quitar contraseña">
                                                                                <i className="bi bi-eye-slash"></i>
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
            </div>
            {/* Modal detalle viaje */}
            <div className="modal fade" id="modalDetalleViaje" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">Detalle de viaje</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            {detalleLoading && <div className="text-center py-3"><span className="spinner-border"></span></div>}
                            {detalle && (
                                <div className="row g-3">
                                    <div className="col-12 col-md-6">
                                        <div><strong>Fecha:</strong> {new Date(detalle.fecha).toLocaleDateString()}</div>
                                        <div><strong>Estado:</strong> <span className={`badge badge-dot ${detalle.estado === 'finalizado' ? 'badge-estado-finalizado' : detalle.estado === 'en curso' ? 'badge-estado-en_curso' : 'badge-estado-pendiente'} text-capitalize`}>{detalle.estado}</span></div>
                                        <div><strong>Origen:</strong> {detalle.origen}</div>
                                        <div><strong>Destino:</strong> {detalle.destino}</div>
                                    </div>
                                    <div className="col-12 col-md-6">
                                        <div><strong>Camión:</strong> {detalle.camion ? `${detalle.camion.patente} (${detalle.camion.marca} ${detalle.camion.modelo}, ${detalle.camion.anio})` : detalle.camionId}</div>
                                        <div><strong>Camionero:</strong> {detalle.camionero?.nombre || '-'}</div>
                                        <div><strong>Tipo mercadería:</strong> {detalle.tipoMercaderia ?? '-'}</div>
                                        <div><strong>Cliente:</strong> {detalle.cliente ?? '-'}</div>
                                        <div><strong>Kilómetros:</strong> {detalle.km ?? '-'}</div>
                                        <div><strong>Combustible:</strong> {detalle.combustible ?? '-'}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-outline-secondary" onClick={() => {
                                if (!detalle) return;
                                const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Camionero', 'Km', 'Combustible'];
                                const row = [
                                    new Date(detalle.fecha).toLocaleDateString(),
                                    detalle.estado || '',
                                    detalle.origen || '',
                                    detalle.destino || '',
                                    detalle.camion ? `${detalle.camion.patente} (${detalle.camion.marca})` : (detalle.camionId || ''),
                                    detalle.camionero?.nombre || '',
                                    detalle.km ?? '',
                                    detalle.combustible ?? ''
                                ];
                                downloadCSV(`viaje_${detalle.id}.csv`, headers, [row]);
                            }}>
                                <i className="bi bi-filetype-csv me-1"></i> Exportar CSV
                            </button>
                            <button type="button" className="btn btn-outline-primary" onClick={() => {
                                if (!detalle) return;
                                const w = window.open('', '_blank');
                                if (!w) return;
                                const html = `<!doctype html><html><head><meta charset='utf-8'><title>Detalle viaje ${detalle.id}</title><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css"></head><body class="p-3"><h4>Detalle de viaje #${detalle.id}</h4><hr/><div><strong>Fecha:</strong> ${new Date(detalle.fecha).toLocaleDateString()}</div><div><strong>Estado:</strong> ${detalle.estado}</div><div><strong>Origen:</strong> ${detalle.origen}</div><div><strong>Destino:</strong> ${detalle.destino}</div><div><strong>Camión:</strong> ${detalle.camion ? `${detalle.camion.patente} (${detalle.camion.marca} ${detalle.camion.modelo}, ${detalle.camion.anio})` : (detalle.camionId || '')}</div><div><strong>Camionero:</strong> ${detalle.camionero?.nombre || '-'}</div><div><strong>Tipo mercadería:</strong> ${detalle.tipoMercaderia ?? '-'}</div><div><strong>Cliente:</strong> ${detalle.cliente ?? '-'}</div><div><strong>Kilómetros:</strong> ${detalle.km ?? '-'}</div><div><strong>Combustible:</strong> ${detalle.combustible ?? '-'}</div></body></html>`;
                                w.document.write(html);
                                w.document.close();
                                w.focus();
                                w.print();
                            }}>
                                <i className="bi bi-printer me-1"></i> Imprimir
                            </button>
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

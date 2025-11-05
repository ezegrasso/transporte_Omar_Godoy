import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { downloadCSV } from '../utils/csv';

export default function Admin() {
    const [camiones, setCamiones] = useState([]);
    const [viajes, setViajes] = useState([]);
    const [usuarios, setUsuarios] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [nuevoCamion, setNuevoCamion] = useState({ patente: '', marca: '', modelo: '', anio: '' });
    const [nuevoViaje, setNuevoViaje] = useState({ origen: '', destino: '', fecha: '', camionId: '' });
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

    const fetchCamiones = async () => {
        const { data } = await api.get('/api/camiones?limit=100');
        const list = (data.items || data.data || []);
        setCamiones(list);
        return list;
    };
    const fetchViajes = async () => {
        const { data } = await api.get('/api/viajes?limit=100');
        const list = data.items || [];
        setViajes(list);
        return list;
    };
    const fetchUsuarios = async () => {
        const { data } = await api.get('/api/usuarios');
        const list = Array.isArray(data) ? data : (data.items || []);
        setUsuarios(list);
        return list;
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try { await Promise.all([fetchCamiones(), fetchViajes(), fetchUsuarios()]); }
            catch (e) { setError(e?.response?.data?.error || 'Error cargando datos'); }
            finally { setLoading(false); }
        })();
    }, []);

    const crearCamion = async (e) => {
        e.preventDefault();
        setError('');
        setSavingCamion(true);
        try {
            const body = { ...nuevoCamion, anio: Number(nuevoCamion.anio) || null };
            const { data: created } = await api.post('/api/camiones', body);
            setNuevoCamion({ patente: '', marca: '', modelo: '', anio: '' });
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
            const body = { ...nuevoViaje, camionId: Number(nuevoViaje.camionId) };
            await api.post('/api/viajes', body);
            setNuevoViaje({ origen: '', destino: '', fecha: '', camionId: '' });
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

    const viajesFiltrados = useMemo(() => {
        const term = busqueda.trim().toLowerCase();
        return viajes.filter(v => {
            const okEstado = !filtroEstado || v.estado === filtroEstado;
            const text = `${v.origen ?? ''} ${v.destino ?? ''} ${v.camion?.patente ?? v.camionId ?? ''} ${v.camionero?.nombre ?? ''}`.toLowerCase();
            const okTexto = !term || text.includes(term);
            return okEstado && okTexto;
        });
    }, [viajes, filtroEstado, busqueda]);

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
        const headers = ['Fecha', 'Origen', 'Destino', 'Estado', 'Camión', 'Camionero', 'Km', 'Combustible'];
        const rows = set.map(v => [
            new Date(v.fecha).toLocaleDateString(),
            v.origen || '',
            v.destino || '',
            v.estado || '',
            v.camion?.patente || v.camionId || '',
            v.camionero?.nombre || '',
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
        <div className="container py-3 space-y-4">
            <div className="d-flex align-items-center justify-content-between">
                <h2 className="mb-0">Panel Admin</h2>
                {loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
            </div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="row g-3">
                <div className="col-lg-6">
                    <div className="card shadow-sm">
                        <div className="card-body">
                            <h3 className="h5">Crear camión</h3>
                            <form onSubmit={crearCamion} className="row g-2 mt-2" style={{ opacity: savingCamion ? 0.85 : 1 }}>
                                <div className="col-6"><input className="form-control" placeholder="Patente" value={nuevoCamion.patente} onChange={e => setNuevoCamion(v => ({ ...v, patente: e.target.value }))} /></div>
                                <div className="col-6"><input className="form-control" placeholder="Marca" value={nuevoCamion.marca} onChange={e => setNuevoCamion(v => ({ ...v, marca: e.target.value }))} /></div>
                                <div className="col-6"><input className="form-control" placeholder="Modelo" value={nuevoCamion.modelo} onChange={e => setNuevoCamion(v => ({ ...v, modelo: e.target.value }))} /></div>
                                <div className="col-6"><input className="form-control" placeholder="Año" value={nuevoCamion.anio} onChange={e => setNuevoCamion(v => ({ ...v, anio: e.target.value }))} /></div>
                                <div className="col-12"><button className="btn btn-primary" disabled={savingCamion}>{savingCamion ? 'Guardando…' : 'Guardar'}</button></div>
                            </form>
                            <div className="table-responsive mt-3">
                                <table className="table table-sm table-hover align-middle mb-0">
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
                    <div className="d-flex flex-wrap gap-2 align-items-end mb-3">
                        <h3 className="h5 mb-0 me-auto">Viajes</h3>
                        <div>
                            <label className="form-label mb-1">Estado</label>
                            <select className="form-select form-select-sm" value={filtroEstado} onChange={e => { setFiltroEstado(e.target.value); setPage(1); }}>
                                <option value="">Todos</option>
                                <option value="pendiente">Pendiente</option>
                                <option value="en_curso">En curso</option>
                                <option value="finalizado">Finalizado</option>
                            </select>
                        </div>
                        <div>
                            <label className="form-label mb-1">Buscar</label>
                            <input className="form-control form-control-sm" placeholder="Origen, destino, patente, chofer" value={busqueda} onChange={e => { setBusqueda(e.target.value); setPage(1); }} />
                        </div>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => exportViajes('filtro')} title="Exportar viajes filtrados">
                            <i className="bi bi-filetype-csv me-1"></i> Exportar (filtro)
                        </button>
                        <button className="btn btn-sm btn-outline-secondary" onClick={() => exportViajes('pagina')} title="Exportar viajes de esta página">
                            <i className="bi bi-file-earmark-spreadsheet me-1"></i> Exportar (página)
                        </button>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-striped table-hover">
                            <thead>
                                <tr>
                                    {['fecha', 'origen', 'destino', 'estado', 'camion', 'camionero'].map((k) => (
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
                                </tr>
                            </thead>
                            <tbody>
                                {viajesPagina.map(v => (
                                    <tr key={v.id}>
                                        <td>{new Date(v.fecha).toLocaleDateString()}</td>
                                        <td>{v.origen}</td>
                                        <td>{v.destino}</td>
                                        <td>{v.estado}</td>
                                        <td>{v.camion?.patente || v.camionId}</td>
                                        <td>{v.camionero?.nombre || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                                <table className="table table-sm table-hover align-middle mb-0">
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
                                                        <span className="badge text-bg-secondary">{u.rol}</span>
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
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

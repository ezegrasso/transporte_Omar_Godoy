import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { generarListadoViajesPDF, generarDetalleViajePDF, generarFacturaViajePDF } from '../utils/pdf';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import React from 'react';

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
            <div className="mt-3">
                {acoplados.length === 0 ? (
                    <EmptyState title="Sin acoplados" description="Todavía no cargaste acoplados" />
                ) : (
                    <div className="row g-3">
                        {acoplados.map(a => (
                            <div key={a.id} className="col-12 col-sm-6 col-md-4 col-lg-3">
                                <div className="card h-100 shadow-sm">
                                    <div className="card-body">
                                        {editId === a.id ? (
                                            <>
                                                <div className="mb-3">
                                                    <label className="form-label small mb-1">Patente</label>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={editData.patente}
                                                        onChange={e => setEditData(v => ({ ...v, patente: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="d-flex gap-2">
                                                    <button className="btn btn-sm btn-success flex-fill" onClick={() => saveEdit(a.id)}>
                                                        <i className="bi bi-check-lg me-1"></i>Guardar
                                                    </button>
                                                    <button className="btn btn-sm btn-outline-secondary flex-fill" onClick={() => setEditId(null)}>
                                                        <i className="bi bi-x-lg me-1"></i>Cancelar
                                                    </button>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <h6 className="card-title mb-3 d-flex align-items-center">
                                                    <i className="bi bi-box-seam me-2 text-secondary"></i>
                                                    <strong>{a.patente}</strong>
                                                </h6>
                                                <div className="d-flex gap-2">
                                                    <button
                                                        className="btn btn-sm btn-outline-primary flex-fill"
                                                        onClick={() => { setEditId(a.id); setEditData({ patente: a.patente || '' }); }}
                                                        title="Editar"
                                                    >
                                                        <i className="bi bi-pencil"></i>
                                                    </button>
                                                    <button
                                                        className="btn btn-sm btn-outline-danger flex-fill"
                                                        onClick={() => eliminar(a.id)}
                                                        title="Eliminar"
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
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
    const [clientes, setClientes] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [nuevoCamion, setNuevoCamion] = useState({ patente: '', marca: '', modelo: '', anio: '' });
    const [camionErrors, setCamionErrors] = useState({});
    const [nuevoViaje, setNuevoViaje] = useState({ origen: '', destino: '', fecha: '', camionId: '', tipoMercaderia: '', cliente: '', precioTonelada: '' });
    const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', password: '', rol: 'camionero' });
    const [nuevoCliente, setNuevoCliente] = useState({ nombre: '', cuit: '' });
    const [savingCamion, setSavingCamion] = useState(false);
    const [savingViaje, setSavingViaje] = useState(false);
    const [savingUsuario, setSavingUsuario] = useState(false);
    const [savingCliente, setSavingCliente] = useState(false);
    const { showToast } = useToast();
    const [filtroEstado, setFiltroEstado] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [sortKey, setSortKey] = useState('fecha');
    const [sortDir, setSortDir] = useState('desc');
    const [page, setPage] = useState(1);
    const pageSize = 10;
    const compact = true;

    const viajesFinalizados = useMemo(() => (viajes || []).filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajes]);

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

    const fetchClientes = async () => {
        try {
            const { data } = await api.get('/clientes');
            const list = Array.isArray(data) ? data : (data.data || []);
            setClientes(list);
            return list;
        } catch (e) {
            console.error('Error cargando clientes:', e);
            return [];
        }
    };

    const openFinalizarModal = (id) => {
        setModalFinalizarId(id);
        setFinalizarData({ km: '', combustible: '', kilosCargados: '', importe: '' });
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
            const body = { km: Number(finalizarData.km), combustible: Number(finalizarData.combustible), importe: Number(finalizarData.importe) };
            if (String(finalizarData.kilosCargados).trim() !== '') body.kilosCargados = Number(finalizarData.kilosCargados);
            await api.patch(`/viajes/${id}/finalizar`, body);
            setFinalizarData({ km: '', combustible: '', kilosCargados: '', importe: '' });
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
        const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Acoplado', 'Camionero', 'Tipo', 'Cliente', 'Km', 'Combustible', 'Toneladas', 'Precio/Tn', 'Importe'];
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
            try { await Promise.all([fetchCamiones(), fetchAcoplados(), fetchViajes(), fetchUsuarios(), fetchClientes()]); }
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

    const crearCliente = async (e) => {
        e.preventDefault();
        setError('');
        setSavingCliente(true);
        try {
            const body = {
                nombre: (nuevoCliente.nombre || '').trim(),
                cuit: (nuevoCliente.cuit || '').trim() || null
            };

            if (!body.nombre) {
                showToast('El nombre del cliente es requerido', 'error');
                setSavingCliente(false);
                return;
            }

            await api.post('/clientes', body);
            setNuevoCliente({ nombre: '', cuit: '' });
            await fetchClientes();
            showToast('Cliente creado', 'success');
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error creando cliente';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setSavingCliente(false);
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
    }, [reporte, viajes]);

    const porCamioneroTop = useMemo(() => {
        const map = viajes.reduce((acc, v) => {
            const nombre = v.camionero?.nombre || v.camioneroNombre || '';
            // Solo contar si tiene nombre
            if (nombre.trim()) {
                acc[nombre] = (acc[nombre] || 0) + 1;
            }
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
            const text = `${v.origen ?? ''} ${v.destino ?? ''} ${v.tipoMercaderia ?? ''} ${v.cliente ?? ''} ${v.camion?.patente ?? v.camionId ?? ''} ${v.acoplado?.patente ?? v.acopladoPatente ?? ''} ${v.camionero?.nombre ?? ''}`.toLowerCase();
            const okTexto = !term || text.includes(term);
            const okCamion = !filtroCamion || (v.camion?.patente || v.camionId || '') === filtroCamion;
            const okCamionero = !filtroCamionero || (v.camionero?.nombre || '') === filtroCamionero;
            const okTipo = !filtroTipo || (v.tipoMercaderia || '') === filtroTipo;
            const okCliente = !filtroCliente || (v.cliente || '') === filtroCliente;
            return okEstado && okTexto && okCamion && okCamionero && okTipo && okCliente;
        });
    }, [viajes, filtroEstado, busqueda, filtroCamion, filtroCamionero, filtroTipo, filtroCliente]);
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
    const [finalizarData, setFinalizarData] = useState({ km: '', combustible: '', kilosCargados: '', importe: '' });
    const [finalizarPasoConfirm, setFinalizarPasoConfirm] = useState(false);
    const [confirmChecked, setConfirmChecked] = useState(false);
    const [showFinalizarModal, setShowFinalizarModal] = useState(false);
    const [modalFinalizarId, setModalFinalizarId] = useState(null);
    const [finishingId, setFinishingId] = useState(null);

    // Estados para editar importe de viaje finalizado
    const [editarImporteModal, setEditarImporteModal] = useState({ show: false, viajeId: null, importeActual: '', nuevoImporte: '', loading: false });

    // Estados para observaciones
    const [observacionesModal, setObservacionesModal] = useState({ show: false, viajeId: null, texto: '', loading: false, error: '' });

    const openEditarImporteModal = (v) => {
        setEditarImporteModal({ show: true, viajeId: v.id, viaje: v, importeActual: v.importe, nuevoImporte: v.importe || '', loading: false });
    };

    const closeEditarImporteModal = () => {
        setEditarImporteModal({ show: false, viajeId: null, viaje: null, importeActual: '', nuevoImporte: '', loading: false });
    };

    const guardarNuevoImporte = async () => {
        const { viajeId, nuevoImporte } = editarImporteModal;
        if (!nuevoImporte || Number(nuevoImporte) < 0) {
            showToast('Ingresa un importe válido', 'error');
            return;
        }
        setEditarImporteModal(prev => ({ ...prev, loading: true }));
        try {
            await api.patch(`/viajes/${viajeId}/editar-importe`, { importe: Number(nuevoImporte) });
            showToast('Importe actualizado correctamente', 'success');
            await fetchViajes();
            closeEditarImporteModal();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error actualizando importe';
            showToast(msg, 'error');
        } finally {
            setEditarImporteModal(prev => ({ ...prev, loading: false }));
        }
    };

    const openObservaciones = (v) => {
        setObservacionesModal({ show: true, viajeId: v.id, viaje: v, texto: v.observacionesCeo || '', loading: false, error: '' });
    };

    const closeObservaciones = () => {
        setObservacionesModal({ show: false, viajeId: null, viaje: null, texto: '', loading: false, error: '' });
    };

    const guardarObservaciones = async () => {
        const { viajeId, texto } = observacionesModal;
        if (!viajeId) return;
        setObservacionesModal(prev => ({ ...prev, loading: true, error: '' }));
        try {
            await api.patch(`/viajes/${viajeId}/observaciones`, { observaciones: texto, panel: 'ceo' });
            showToast('Observaciones guardadas correctamente', 'success');
            await fetchViajes();
            closeObservaciones();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error al guardar observaciones';
            setObservacionesModal(prev => ({ ...prev, loading: false, error: msg }));
        }
    };

    // Estados para modal de adelantos
    const [adelantoModal, setAdelantoModal] = useState({ open: false, camioneroId: null, camioneroNombre: '', monto: '', descripcion: '', mes: '', anio: '', loading: false, error: '' });
    const openAdelantoModal = (camioneroId, camioneroNombre) => {
        const hoy = new Date();
        setAdelantoModal({
            open: true,
            camioneroId,
            camioneroNombre,
            monto: '',
            descripcion: '',
            mes: String(hoy.getMonth() + 1).padStart(2, '0'),
            anio: String(hoy.getFullYear()),
            loading: false,
            error: ''
        });
    };
    const closeAdelantoModal = () => setAdelantoModal({ open: false, camioneroId: null, camioneroNombre: '', monto: '', descripcion: '', mes: '', anio: '', loading: false, error: '' });

    // Modal para gestionar adelantos existentes
    const [gestionAdelantosModal, setGestionAdelantosModal] = useState({ open: false, adelantos: [], loading: false, editando: null, montoEdit: '', descripcionEdit: '' });
    const openGestionAdelantos = async () => {
        setGestionAdelantosModal({ open: true, adelantos: [], loading: true, editando: null, montoEdit: '', descripcionEdit: '' });
        try {
            const hoy = new Date();
            const mesActual = hoy.getMonth() + 1;
            const anioActual = hoy.getFullYear();

            // Obtener adelantos de todos los camioneros del mes actual
            const adelantosPromises = camioneros.map(async (c) => {
                try {
                    const { data } = await api.get(`/adelantos/camionero/${c.id}`);
                    return data.filter(a => a.mes === mesActual && a.anio === anioActual).map(a => ({ ...a, camioneroNombre: c.nombre }));
                } catch {
                    return [];
                }
            });
            const resultados = await Promise.all(adelantosPromises);
            const todosAdelantos = resultados.flat().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

            setGestionAdelantosModal(m => ({ ...m, adelantos: todosAdelantos, loading: false }));
        } catch (e) {
            setGestionAdelantosModal(m => ({ ...m, loading: false }));
            showToast('Error cargando adelantos', 'error');
        }
    };
    const closeGestionAdelantos = () => setGestionAdelantosModal({ open: false, adelantos: [], loading: false, editando: null, montoEdit: '', descripcionEdit: '' });
    const startEditAdelanto = (adelanto) => {
        setGestionAdelantosModal(m => ({
            ...m,
            editando: adelanto.id,
            montoEdit: adelanto.monto,
            descripcionEdit: adelanto.descripcion || ''
        }));
    };
    const cancelEditAdelanto = () => {
        setGestionAdelantosModal(m => ({ ...m, editando: null, montoEdit: '', descripcionEdit: '' }));
    };
    const saveEditAdelanto = async (id) => {
        try {
            await api.patch(`/adelantos/${id}`, {
                monto: parseFloat(gestionAdelantosModal.montoEdit),
                descripcion: gestionAdelantosModal.descripcionEdit
            });
            showToast('Adelanto actualizado', 'success');
            // Recargar
            openGestionAdelantos();
        } catch (e) {
            showToast('Error actualizando adelanto', 'error');
        }
    };
    const deleteAdelanto = async (id) => {
        if (!confirm('¿Eliminar este adelanto?')) return;
        try {
            await api.delete(`/adelantos/${id}`);
            showToast('Adelanto eliminado', 'success');
            // Recargar
            openGestionAdelantos();
        } catch (e) {
            showToast('Error eliminando adelanto', 'error');
        }
    };

    const submitAdelanto = async () => {
        if (!adelantoModal.camioneroId) {
            setAdelantoModal(m => ({ ...m, error: 'Debes seleccionar un camionero' }));
            return;
        }
        if (!adelantoModal.monto || !adelantoModal.mes || !adelantoModal.anio) {
            setAdelantoModal(m => ({ ...m, error: 'Monto, mes y año son requeridos' }));
            return;
        }
        setAdelantoModal(m => ({ ...m, loading: true, error: '' }));
        try {
            await api.post('/adelantos', {
                camioneroId: adelantoModal.camioneroId,
                monto: parseFloat(adelantoModal.monto),
                mes: parseInt(adelantoModal.mes),
                anio: parseInt(adelantoModal.anio),
                descripcion: adelantoModal.descripcion || null
            });
            showToast('Adelanto registrado y email enviado', 'success');
            closeAdelantoModal();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error al registrar adelanto';
            setAdelantoModal(m => ({ ...m, loading: false, error: msg }));
            showToast(msg, 'error');
        }
    };

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
                            <>
                                {/* Botón de Adelantos */}
                                <button className="btn btn-success" onClick={() => openAdelantoModal(null, '')} title="Registrar adelanto">
                                    <i className="bi bi-cash-coin me-1"></i>
                                    Adelanto
                                </button>
                                {/* Botón de Gestionar Adelantos */}
                                <button className="btn btn-outline-success" onClick={openGestionAdelantos} title="Gestionar adelantos del mes">
                                    <i className="bi bi-pencil-square me-1"></i>
                                    Gestionar
                                </button>
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
                            </>
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

                <div className="row g-3 mt-1">
                    <div className="col-lg-12">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Crear viaje</h3>
                                <form onSubmit={crearViaje} className="row g-2 mt-2" style={{ opacity: savingViaje ? 0.85 : 1 }}>
                                    <div className="col-6"><input className="form-control" placeholder="Origen" value={nuevoViaje.origen} onChange={e => setNuevoViaje(v => ({ ...v, origen: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" placeholder="Destino" value={nuevoViaje.destino} onChange={e => setNuevoViaje(v => ({ ...v, destino: e.target.value }))} /></div>
                                    <div className="col-6"><input className="form-control" placeholder="Tipo de mercadería" value={nuevoViaje.tipoMercaderia} onChange={e => setNuevoViaje(v => ({ ...v, tipoMercaderia: e.target.value }))} /></div>
                                    <div className="col-6">
                                        <select className="form-select" value={nuevoViaje.cliente} onChange={e => setNuevoViaje(v => ({ ...v, cliente: e.target.value }))}>
                                            <option value="">Seleccioná cliente</option>
                                            {clientes.map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                                        </select>
                                    </div>
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
                </div>
                <hr />
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
                        <hr />
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
                        <hr />
                        <div className="table-responsive">
                            {viajesFiltrados.length === 0 ? (
                                <EmptyState title="Sin viajes" description="No hay viajes que coincidan con el filtro" />
                            ) : (
                                <table className={`table table-sm table-striped table-hover table-sticky table-cols-bordered`}>
                                    <thead>
                                        <tr>
                                            {['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Acoplado', 'Camionero', 'Tipo', 'Cliente', 'Km', 'Combustible', 'Toneladas', 'Precio/Tn', 'Importe'].map((label) => (
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
                                                <td className="text-end" style={{ width: 200 }}>
                                                    <div className="d-flex gap-2 justify-content-end align-items-center">
                                                        <button
                                                            className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                                                            onClick={() => abrirDetalle(v.id)}
                                                            title="Ver detalle"
                                                            style={{
                                                                width: '32px',
                                                                height: '32px',
                                                                background: 'linear-gradient(135deg, #67e8f9 0%, #22d3ee 100%)',
                                                                color: '#164e63',
                                                                border: 'none',
                                                                borderRadius: '0.375rem',
                                                                boxShadow: '0 2px 8px rgba(103, 232, 249, 0.25)',
                                                                transition: 'all 0.2s ease',
                                                                cursor: 'pointer',
                                                                padding: 0
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(103, 232, 249, 0.35)';
                                                                e.currentTarget.style.transform = 'translateY(-1px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.boxShadow = '0 2px 8px rgba(103, 232, 249, 0.25)';
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <i className="bi bi-eye"></i>
                                                        </button>
                                                        {v.estado === 'pendiente' && (
                                                            <>
                                                                <button
                                                                    className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                                                                    onClick={() => openEditViaje(v)}
                                                                    title="Editar"
                                                                    style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        background: 'linear-gradient(135deg, #6ee7b7 0%, #34d399 100%)',
                                                                        color: '#064e3b',
                                                                        border: 'none',
                                                                        borderRadius: '0.375rem',
                                                                        boxShadow: '0 2px 8px rgba(110, 231, 183, 0.25)',
                                                                        transition: 'all 0.2s ease',
                                                                        cursor: 'pointer',
                                                                        padding: 0
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(110, 231, 183, 0.35)';
                                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(110, 231, 183, 0.25)';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                                                                    title="Eliminar"
                                                                    onClick={() => {
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
                                                                    }}
                                                                    style={{
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        background: 'linear-gradient(135deg, #fca5a5 0%, #f87171 100%)',
                                                                        color: '#7f1d1d',
                                                                        border: 'none',
                                                                        borderRadius: '0.375rem',
                                                                        boxShadow: '0 2px 8px rgba(252, 165, 165, 0.25)',
                                                                        transition: 'all 0.2s ease',
                                                                        cursor: 'pointer',
                                                                        padding: 0
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(252, 165, 165, 0.35)';
                                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(252, 165, 165, 0.25)';
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                    }}
                                                                >
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            </>
                                                        )}
                                                        {(v.estado === 'en curso' || v.estado === 'pendiente') && (
                                                            <button
                                                                className="btn btn-sm d-inline-flex align-items-center gap-2 px-3"
                                                                onClick={() => openFinalizarModal(v.id)}
                                                                title="Finalizar viaje"
                                                                style={{
                                                                    background: 'linear-gradient(135deg, #86efac 0%, #4ade80 100%)',
                                                                    color: '#14532d',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.9rem',
                                                                    border: 'none',
                                                                    borderRadius: '0.375rem',
                                                                    boxShadow: '0 2px 8px rgba(134, 239, 172, 0.25)',
                                                                    transition: 'all 0.2s ease',
                                                                    cursor: 'pointer',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.target.style.boxShadow = '0 4px 12px rgba(134, 239, 172, 0.35)';
                                                                    e.target.style.transform = 'translateY(-1px)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.target.style.boxShadow = '0 2px 8px rgba(134, 239, 172, 0.25)';
                                                                    e.target.style.transform = 'translateY(0)';
                                                                }}
                                                            >
                                                                <i className="bi bi-check-circle-fill"></i>
                                                                <span className="d-none d-lg-inline">Finalizar</span>
                                                            </button>
                                                        )}
                                                        {v.estado === 'en curso' && (
                                                            <button
                                                                className="btn btn-sm d-inline-flex align-items-center justify-content-center"
                                                                onClick={async () => {
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
                                                                }}
                                                                title="Liberar"
                                                                style={{
                                                                    width: '32px',
                                                                    height: '32px',
                                                                    background: 'linear-gradient(135deg, #fdba74 0%, #fb923c 100%)',
                                                                    color: '#7c2d12',
                                                                    border: 'none',
                                                                    borderRadius: '0.375rem',
                                                                    boxShadow: '0 2px 8px rgba(253, 186, 116, 0.25)',
                                                                    transition: 'all 0.2s ease',
                                                                    cursor: 'pointer',
                                                                    padding: 0
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(253, 186, 116, 0.35)';
                                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(253, 186, 116, 0.25)';
                                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                                }}
                                                            >
                                                                <i className="bi bi-unlock"></i>
                                                            </button>
                                                        )}
                                                        {v.estado === 'finalizado' && (
                                                            <button
                                                                className="btn btn-sm d-inline-flex align-items-center gap-2 px-3"
                                                                onClick={() => openEditarImporteModal(v)}
                                                                title="Editar importe"
                                                                style={{
                                                                    background: 'linear-gradient(135deg, #fde68a 0%, #fcd34d 100%)',
                                                                    color: '#713f12',
                                                                    fontWeight: '600',
                                                                    fontSize: '0.9rem',
                                                                    border: 'none',
                                                                    borderRadius: '0.375rem',
                                                                    boxShadow: '0 2px 8px rgba(253, 230, 138, 0.25)',
                                                                    transition: 'all 0.2s ease',
                                                                    cursor: 'pointer',
                                                                    whiteSpace: 'nowrap'
                                                                }}
                                                                onMouseEnter={(e) => {
                                                                    e.target.style.boxShadow = '0 4px 12px rgba(253, 230, 138, 0.35)';
                                                                    e.target.style.transform = 'translateY(-1px)';
                                                                }}
                                                                onMouseLeave={(e) => {
                                                                    e.target.style.boxShadow = '0 2px 8px rgba(253, 230, 138, 0.25)';
                                                                    e.target.style.transform = 'translateY(0)';
                                                                }}
                                                            >
                                                                <i className="bi bi-pencil-square"></i>
                                                                <span className="d-none d-lg-inline">Editar $</span>
                                                            </button>
                                                        )}
                                                        <button
                                                            className="btn btn-sm d-inline-flex align-items-center gap-2 px-3"
                                                            onClick={() => openObservaciones(v)}
                                                            title={v.observacionesCeo ? "Ver/editar observaciones" : "Agregar observaciones"}
                                                            style={{
                                                                background: 'linear-gradient(135deg, #e9d5ff 0%, #d8b4fe 100%)',
                                                                color: '#581c87',
                                                                fontWeight: '600',
                                                                fontSize: '0.9rem',
                                                                border: 'none',
                                                                borderRadius: '0.375rem',
                                                                boxShadow: '0 2px 8px rgba(233, 213, 255, 0.25)',
                                                                transition: 'all 0.2s ease',
                                                                cursor: 'pointer',
                                                                whiteSpace: 'nowrap'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.target.style.boxShadow = '0 4px 12px rgba(233, 213, 255, 0.35)';
                                                                e.target.style.transform = 'translateY(-1px)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.target.style.boxShadow = '0 2px 8px rgba(233, 213, 255, 0.25)';
                                                                e.target.style.transform = 'translateY(0)';
                                                            }}
                                                        >
                                                            <i className={`bi ${v.observacionesCeo ? 'bi-chat-left-text-fill' : 'bi-chat-left-text'}`}></i>
                                                            {v.observacionesCeo && <span className="d-none d-lg-inline">Ver nota</span>}
                                                        </button>
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
                <hr />
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

                <div className="row g-3 mt-3">
                    <div className="col-12">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5">Clientes</h3>
                                <form onSubmit={crearCliente} className="row g-2 mt-2" style={{ opacity: savingCliente ? 0.85 : 1 }}>
                                    <div className="col-8"><input className="form-control" placeholder="Nombre del cliente" value={nuevoCliente.nombre} onChange={e => setNuevoCliente(v => ({ ...v, nombre: e.target.value }))} /></div>
                                    <div className="col-4"><input className="form-control" placeholder="CUIT" value={nuevoCliente.cuit} onChange={e => setNuevoCliente(v => ({ ...v, cuit: e.target.value }))} /></div>
                                    <div className="col-12"><button className="btn btn-primary" disabled={savingCliente}>{savingCliente ? 'Creando…' : 'Crear cliente'}</button></div>
                                </form>
                                <div className="table-responsive mt-3">
                                    {clientes.length === 0 ? (
                                        <EmptyState title="Sin clientes" description="Todavía no cargaste clientes" />
                                    ) : (
                                        <table className={`table table-sm table-hover align-middle mb-0 table-sticky table-cols-bordered`}>
                                            <thead>
                                                <tr>
                                                    <th className="text-uppercase small">Nombre</th>
                                                    <th className="text-uppercase small">CUIT</th>
                                                    <th className="text-end text-uppercase small" style={{ minWidth: 100 }}>Acciones</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {clientes.map(c => (
                                                    <tr key={c.id}>
                                                        <td>{c.nombre}</td>
                                                        <td>{c.cuit || '-'}</td>
                                                        <td className="text-end">
                                                            <button className="btn btn-sm btn-outline-danger" onClick={async () => {
                                                                if (window.confirm(`¿Eliminar cliente "${c.nombre}"?`)) {
                                                                    try {
                                                                        await api.delete(`/clientes/${c.id}`);
                                                                        await fetchClientes();
                                                                        showToast('Cliente eliminado', 'success');
                                                                    } catch (e) {
                                                                        showToast(e?.response?.data?.error || 'Error al eliminar', 'error');
                                                                    }
                                                                }
                                                            }} title="Eliminar"><i className="bi bi-trash"></i></button>
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
                <hr />
                <div className="row g-3">
                    <div className="col-12">
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
                                <div className="mt-3">
                                    {camiones.length === 0 ? (
                                        <EmptyState title="Sin camiones" description="Todavía no cargaste ningún camión" />
                                    ) : (
                                        <div className="row g-3">
                                            {camiones.map(c => (
                                                <div key={c.id} className="col-12 col-md-6 col-lg-4 col-xl-3">
                                                    <div className={`card h-100 shadow-sm ${savedCamionId === c.id ? 'border-success' : ''}`}>
                                                        <div className="card-body">
                                                            {editCamionId === c.id ? (
                                                                <>
                                                                    <div className="mb-2">
                                                                        <label className="form-label small mb-1">Patente</label>
                                                                        <input className="form-control form-control-sm" value={editCamionData.patente} onChange={e => setEditCamionData(v => ({ ...v, patente: e.target.value }))} />
                                                                    </div>
                                                                    <div className="mb-2">
                                                                        <label className="form-label small mb-1">Marca</label>
                                                                        <input className="form-control form-control-sm" value={editCamionData.marca} onChange={e => setEditCamionData(v => ({ ...v, marca: e.target.value }))} />
                                                                    </div>
                                                                    <div className="mb-2">
                                                                        <label className="form-label small mb-1">Modelo</label>
                                                                        <input className="form-control form-control-sm" value={editCamionData.modelo} onChange={e => setEditCamionData(v => ({ ...v, modelo: e.target.value }))} />
                                                                    </div>
                                                                    <div className="mb-3">
                                                                        <label className="form-label small mb-1">Año</label>
                                                                        <input className="form-control form-control-sm" type="number" value={editCamionData.anio} onChange={e => setEditCamionData(v => ({ ...v, anio: e.target.value }))} />
                                                                    </div>
                                                                    <div className="d-flex flex-column gap-2">
                                                                        <button className="btn btn-sm btn-success w-100" onClick={() => saveEditCamion(c.id)}>
                                                                            <i className="bi bi-check-lg me-1"></i>Guardar
                                                                        </button>
                                                                        <button className="btn btn-sm btn-outline-secondary w-100" onClick={cancelEditCamion}>
                                                                            <i className="bi bi-x-lg me-1"></i>Cancelar
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <h6 className="card-title mb-2 d-flex align-items-center">
                                                                        <i className="bi bi-truck me-2 text-primary"></i>
                                                                        <strong>{c.patente}</strong>
                                                                    </h6>
                                                                    <p className="card-text small mb-1">
                                                                        <strong>{c.marca}</strong> {c.modelo}
                                                                    </p>
                                                                    <p className="card-text small text-muted mb-3">
                                                                        <i className="bi bi-calendar me-1"></i>Año: {c.anio || '-'}
                                                                    </p>
                                                                    <div className="mb-3">
                                                                        <label className="form-label small mb-1">
                                                                            <i className="bi bi-person me-1"></i>Camionero
                                                                        </label>
                                                                        {camioneros.length === 0 ? (
                                                                            <span className="text-body-secondary small d-block">Sin camioneros cargados</span>
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
                                                                                    <option key={cm.id} value={cm.id}>{cm.nombre}</option>
                                                                                ))}
                                                                            </select>
                                                                        )}
                                                                    </div>
                                                                    <div className="d-flex gap-2">
                                                                        <button className="btn btn-sm btn-outline-primary flex-fill" onClick={() => startEditCamion(c)} title="Editar">
                                                                            <i className="bi bi-pencil"></i>
                                                                        </button>
                                                                        <button className="btn btn-sm btn-outline-danger flex-fill" onClick={() => deleteCamion(c.id)} title="Eliminar">
                                                                            <i className="bi bi-trash"></i>
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="row g-3 mt-1">
                    <div className="col-12">
                        <div className="card shadow-sm">
                            <div className="card-body">
                                <h3 className="h5 mb-3">Acoplados</h3>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    const patente = e.target.patente.value.toUpperCase().trim();
                                    if (!patente) { showToast('La patente es requerida', 'error'); return; }
                                    const patenteRegex = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;
                                    if (!patenteRegex.test(patente)) { showToast('Formato inválido (AAA123 o AB123CD)', 'error'); return; }
                                    try {
                                        await api.post('/acoplados', { patente });
                                        e.target.reset();
                                        await fetchAcoplados();
                                        showToast('Acoplado creado', 'success');
                                    } catch (err) {
                                        const msg = err?.response?.data?.error || 'Error creando acoplado';
                                        showToast(msg, 'error');
                                    }
                                }} className="row g-2">
                                    <div className="col-auto">
                                        <input name="patente" className="form-control" placeholder="Patente acoplado" />
                                    </div>
                                    <div className="col-auto">
                                        <button className="btn btn-primary">Crear acoplado</button>
                                    </div>
                                </form>
                                <div className="mt-3">
                                    {acoplados.length === 0 ? (
                                        <EmptyState title="Sin acoplados" description="Todavía no cargaste acoplados" />
                                    ) : (
                                        <div className="row g-3">
                                            {acoplados.map(a => (
                                                <div key={a.id} className="col-6 col-sm-4 col-md-3 col-lg-2">
                                                    <div className="card h-100 shadow-sm">
                                                        <div className="card-body p-2">
                                                            <h6 className="card-title mb-2 d-flex align-items-center justify-content-center">
                                                                <i className="bi bi-box-seam me-1 text-secondary"></i>
                                                                <strong style={{ fontSize: '0.85rem' }}>{a.patente}</strong>
                                                            </h6>
                                                            <div className="d-flex gap-1">
                                                                <button
                                                                    className="btn btn-sm btn-outline-primary flex-fill p-1"
                                                                    onClick={async () => {
                                                                        const nuevaPatente = prompt('Nueva patente:', a.patente);
                                                                        if (!nuevaPatente || nuevaPatente === a.patente) return;
                                                                        const p = nuevaPatente.toUpperCase().trim();
                                                                        const patenteRegex = /^([A-Z]{3}\d{3}|[A-Z]{2}\d{3}[A-Z]{2})$/;
                                                                        if (!patenteRegex.test(p)) { showToast('Formato inválido', 'error'); return; }
                                                                        try {
                                                                            await api.patch(`/acoplados/${a.id}`, { patente: p });
                                                                            await fetchAcoplados();
                                                                            showToast('Acoplado actualizado', 'success');
                                                                        } catch (err) {
                                                                            const msg = err?.response?.data?.error || 'Error actualizando acoplado';
                                                                            showToast(msg, 'error');
                                                                        }
                                                                    }}
                                                                    title="Editar"
                                                                >
                                                                    <i className="bi bi-pencil"></i>
                                                                </button>
                                                                <button
                                                                    className="btn btn-sm btn-outline-danger flex-fill p-1"
                                                                    onClick={async () => {
                                                                        if (!confirm('¿Eliminar acoplado?')) return;
                                                                        try {
                                                                            await api.delete(`/acoplados/${a.id}`);
                                                                            await fetchAcoplados();
                                                                            showToast('Acoplado eliminado', 'success');
                                                                        } catch (err) {
                                                                            const msg = err?.response?.data?.error || 'Error eliminando acoplado';
                                                                            showToast(msg, 'error');
                                                                        }
                                                                    }}
                                                                    title="Eliminar"
                                                                >
                                                                    <i className="bi bi-trash"></i>
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
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
                                            <div><strong>Toneladas cargadas:</strong> {detalle.kilosCargados ?? '-'}</div>
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
                                                        <div><strong>Toneladas cargadas:</strong> {viajeSeleccionado.kilosCargados ?? '-'}</div>
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
                                                        <label className="form-label">Toneladas cargadas</label>
                                                        <input className="form-control" type="number" min={0} step={1} value={finalizarData.kilosCargados} onChange={e => setFinalizarData(x => ({ ...x, kilosCargados: e.target.value }))} placeholder="Ingresa las toneladas cargadas" />
                                                    </div>
                                                    <div className="col-12">
                                                        <label className="form-label">Importe del viaje *</label>
                                                        <input className="form-control" type="number" min={0} step={0.01} value={finalizarData.importe} onChange={e => setFinalizarData(x => ({ ...x, importe: e.target.value }))} placeholder="Ingresa el importe del viaje" />
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
                                                        <li><strong>Importe del viaje:</strong> ${finalizarData.importe || '0'}</li>
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

                {/* Modal: Registrar Adelanto */}
                <div className={`modal ${adelantoModal.open ? 'd-block show' : 'fade'}`} tabIndex="-1" aria-hidden={!adelantoModal.open} style={adelantoModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                    <div className="modal-dialog modal-lg">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0 py-4" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' }}>
                                <div className="w-100">
                                    <h5 className="text-white mb-1" style={{ fontSize: '1.3rem', fontWeight: '600' }}>
                                        <i className="bi bi-cash-coin me-2"></i>
                                        Registrar Adelanto
                                    </h5>
                                    <small className="text-white" style={{ opacity: 0.95, fontSize: '0.85rem' }}>Registra un adelanto para un camionero</small>
                                </div>
                                <button type="button" className="btn-close btn-close-white ms-3" onClick={closeAdelantoModal} disabled={adelantoModal.loading}></button>
                            </div>
                            <div className="modal-body">
                                {adelantoModal.error && <div className="alert alert-danger">{adelantoModal.error}</div>}
                                <div className="row g-3">
                                    <div className="col-12">
                                        <label className="form-label">
                                            <strong>Camionero</strong>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={adelantoModal.camioneroId || ''}
                                            onChange={e => {
                                                const id = e.target.value ? Number(e.target.value) : null;
                                                const camionero = camioneros.find(c => c.id === id);
                                                setAdelantoModal(m => ({
                                                    ...m,
                                                    camioneroId: id,
                                                    camioneroNombre: camionero?.nombre || ''
                                                }));
                                            }}
                                            disabled={adelantoModal.loading}
                                        >
                                            <option value="">Seleccionar camionero...</option>
                                            {camioneros.map(c => (
                                                <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">
                                            <strong>Monto ($)</strong>
                                        </label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="0"
                                            step="100"
                                            placeholder="Ej: 5000"
                                            value={adelantoModal.monto}
                                            onChange={e => setAdelantoModal(m => ({ ...m, monto: e.target.value }))}
                                            disabled={adelantoModal.loading}
                                        />
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label">
                                            <strong>Mes</strong>
                                        </label>
                                        <select
                                            className="form-select"
                                            value={adelantoModal.mes}
                                            onChange={e => setAdelantoModal(m => ({ ...m, mes: e.target.value }))}
                                            disabled={adelantoModal.loading}
                                        >
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => {
                                                const date = new Date(adelantoModal.anio, m - 1, 1);
                                                const label = date.toLocaleString('es-AR', { month: 'long' });
                                                return <option key={m} value={String(m).padStart(2, '0')}>{label}</option>;
                                            })}
                                        </select>
                                    </div>
                                    <div className="col-6">
                                        <label className="form-label">
                                            <strong>Año</strong>
                                        </label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            min="2020"
                                            value={adelantoModal.anio}
                                            onChange={e => setAdelantoModal(m => ({ ...m, anio: e.target.value }))}
                                            disabled={adelantoModal.loading}
                                        />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Descripción (opcional)</label>
                                        <textarea
                                            className="form-control"
                                            rows="2"
                                            placeholder="Ej: Adelanto por viajes próximos"
                                            value={adelantoModal.descripcion}
                                            onChange={e => setAdelantoModal(m => ({ ...m, descripcion: e.target.value }))}
                                            disabled={adelantoModal.loading}
                                        ></textarea>
                                    </div>
                                </div>
                                <div className="mt-3 p-3 bg-light rounded">
                                    <small className="text-muted">
                                        <i className="bi bi-info-circle me-1"></i>
                                        Se enviará un email al camionero informando del adelanto registrado.
                                    </small>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeAdelantoModal} disabled={adelantoModal.loading}>
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-success"
                                    onClick={submitAdelanto}
                                    disabled={adelantoModal.loading || !adelantoModal.monto || !adelantoModal.camioneroId}
                                >
                                    {adelantoModal.loading ? (
                                        <>
                                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <i className="bi bi-check-lg me-1"></i>
                                            Registrar Adelanto
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Modal gestionar adelantos */}
                <div className={`modal fade ${gestionAdelantosModal.open ? 'show' : ''}`} style={{ display: gestionAdelantosModal.open ? 'block' : 'none' }} tabIndex="-1">
                    <div className="modal-dialog modal-xl modal-dialog-scrollable">
                        <div className="modal-content border-0 shadow-lg">
                            <div className="modal-header border-0 py-4" style={{ background: 'linear-gradient(135deg, #20c997 0%, #17a2b8 100%)' }}>
                                <div className="w-100">
                                    <h5 className="text-white mb-1" style={{ fontSize: '1.3rem', fontWeight: '600' }}>
                                        <i className="bi bi-pencil-square me-2"></i>
                                        Gestionar Adelantos del Mes
                                    </h5>
                                    <small className="text-white" style={{ opacity: 0.95, fontSize: '0.85rem' }}>Edita o elimina adelantos registrados</small>
                                </div>
                                <button type="button" className="btn-close btn-close-white ms-3" onClick={closeGestionAdelantos}></button>
                            </div>
                            <div className="modal-body p-0">
                                {gestionAdelantosModal.loading ? (
                                    <div className="text-center py-5">
                                        <div className="spinner-border text-success" role="status">
                                            <span className="visually-hidden">Cargando...</span>
                                        </div>
                                        <p className="text-muted mt-3">Cargando adelantos...</p>
                                    </div>
                                ) : gestionAdelantosModal.adelantos.length === 0 ? (
                                    <div className="p-5 text-center">
                                        <i className="bi bi-inbox text-muted" style={{ fontSize: '3rem' }}></i>
                                        <h6 className="mt-3 text-muted">Sin adelantos</h6>
                                        <p className="text-muted small">No hay adelantos registrados en el mes actual</p>
                                    </div>
                                ) : (
                                    <div style={{ overflow: 'hidden' }}>
                                        <table className="table table-hover mb-0" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                                            <thead>
                                                <tr className="bg-light border-bottom border-2">
                                                    <th className="ps-4 py-3">
                                                        <i className="bi bi-person-fill text-muted me-2" style={{ fontSize: '0.9rem' }}></i>
                                                        <strong>Camionero</strong>
                                                    </th>
                                                    <th className="py-3 text-center">
                                                        <i className="bi bi-cash-coin text-muted me-1" style={{ fontSize: '0.9rem' }}></i>
                                                        <strong>Monto</strong>
                                                    </th>
                                                    <th className="py-3">
                                                        <i className="bi bi-calendar-event text-muted me-1" style={{ fontSize: '0.9rem' }}></i>
                                                        <strong>Fecha</strong>
                                                    </th>
                                                    <th className="py-3">
                                                        <i className="bi bi-chat-left-text text-muted me-1" style={{ fontSize: '0.9rem' }}></i>
                                                        <strong>Descripción</strong>
                                                    </th>
                                                    <th className="pe-4 py-3 text-end">
                                                        <strong>Acciones</strong>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {gestionAdelantosModal.adelantos.map((a, idx) => (
                                                    <tr key={a.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-light'} style={{ borderBottom: '1px solid #e9ecef' }}>
                                                        <td className="ps-4 py-3 align-middle">
                                                            <div className="d-flex align-items-center gap-2">
                                                                <div className="avatar rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: '32px', height: '32px' }}>
                                                                    <i className="bi bi-person text-success"></i>
                                                                </div>
                                                                <strong className="mb-0">{a.camioneroNombre}</strong>
                                                            </div>
                                                        </td>
                                                        <td className="py-3 align-middle text-center">
                                                            {gestionAdelantosModal.editando === a.id ? (
                                                                <input
                                                                    type="number"
                                                                    className="form-control form-control-sm"
                                                                    value={gestionAdelantosModal.montoEdit}
                                                                    onChange={e => setGestionAdelantosModal(m => ({ ...m, montoEdit: e.target.value }))}
                                                                    style={{ width: '140px', margin: '0 auto' }}
                                                                />
                                                            ) : (
                                                                <span className="text-success fw-bold" style={{ fontSize: '1.1rem' }}>
                                                                    ${parseFloat(a.monto).toLocaleString('es-AR')}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 align-middle">
                                                            <small className="text-muted">
                                                                {new Date(a.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                            </small>
                                                        </td>
                                                        <td className="py-3 align-middle">
                                                            {gestionAdelantosModal.editando === a.id ? (
                                                                <input
                                                                    type="text"
                                                                    className="form-control form-control-sm"
                                                                    value={gestionAdelantosModal.descripcionEdit}
                                                                    onChange={e => setGestionAdelantosModal(m => ({ ...m, descripcionEdit: e.target.value }))}
                                                                    placeholder="Descripción"
                                                                    style={{ maxWidth: '200px' }}
                                                                />
                                                            ) : (
                                                                <small className="text-dark d-block" style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.descripcion}>
                                                                    {a.descripcion || <span className="text-secondary">-</span>}
                                                                </small>
                                                            )}
                                                        </td>
                                                        <td className="pe-4 py-3 align-middle text-end">
                                                            {gestionAdelantosModal.editando === a.id ? (
                                                                <div className="d-flex gap-2 justify-content-end">
                                                                    <button
                                                                        className="btn btn-sm btn-success"
                                                                        onClick={() => saveEditAdelanto(a.id)}
                                                                        title="Guardar cambios"
                                                                        style={{ width: '36px', height: '36px', padding: '0' }}
                                                                    >
                                                                        <i className="bi bi-check-lg"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-sm btn-outline-secondary"
                                                                        onClick={cancelEditAdelanto}
                                                                        title="Cancelar edición"
                                                                        style={{ width: '36px', height: '36px', padding: '0' }}
                                                                    >
                                                                        <i className="bi bi-x-lg"></i>
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="d-flex gap-2 justify-content-end">
                                                                    <button
                                                                        className="btn btn-sm btn-primary"
                                                                        onClick={() => startEditAdelanto(a)}
                                                                        title="Editar adelanto"
                                                                        style={{ width: '36px', height: '36px', padding: '0' }}
                                                                    >
                                                                        <i className="bi bi-pencil"></i>
                                                                    </button>
                                                                    <button
                                                                        className="btn btn-sm btn-danger"
                                                                        onClick={() => deleteAdelanto(a.id)}
                                                                        title="Eliminar adelanto"
                                                                        style={{ width: '36px', height: '36px', padding: '0' }}
                                                                    >
                                                                        <i className="bi bi-trash"></i>
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer bg-light border-top">
                                <small className="text-muted me-auto">
                                    Total de adelantos: <strong>{gestionAdelantosModal.adelantos.length}</strong>
                                </small>
                                <button type="button" className="btn btn-secondary" onClick={closeGestionAdelantos}>
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal Editar Importe */}
            {editarImporteModal.show && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Editar importe del viaje</h5>
                                <button type="button" className="btn-close" onClick={closeEditarImporteModal}></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label">Viaje</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={`#${editarImporteModal.viaje?.id} - ${editarImporteModal.viaje?.origen} → ${editarImporteModal.viaje?.destino}`}
                                        disabled
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Importe actual</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={`$${editarImporteModal.viaje?.importe || 0}`}
                                        disabled
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Nuevo importe *</label>
                                    <input
                                        type="number"
                                        className="form-control"
                                        min={0}
                                        step={0.01}
                                        value={editarImporteModal.nuevoImporte}
                                        onChange={(e) => setEditarImporteModal(prev => ({ ...prev, nuevoImporte: e.target.value }))}
                                        placeholder="Ingresá el nuevo importe"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeEditarImporteModal} disabled={editarImporteModal.loading}>
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={guardarNuevoImporte}
                                    disabled={editarImporteModal.loading || !editarImporteModal.nuevoImporte}
                                >
                                    {editarImporteModal.loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Observaciones */}
            {observacionesModal.show && (
                <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Observaciones del viaje</h5>
                                <button type="button" className="btn-close" onClick={closeObservaciones}></button>
                            </div>
                            <div className="modal-body">
                                <div className="mb-3">
                                    <label className="form-label">Viaje</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={`#${observacionesModal.viaje?.id} - ${observacionesModal.viaje?.origen} → ${observacionesModal.viaje?.destino}`}
                                        disabled
                                    />
                                </div>
                                <div className="mb-3">
                                    <label className="form-label">Observaciones</label>
                                    <textarea
                                        className="form-control"
                                        rows={5}
                                        value={observacionesModal.texto}
                                        onChange={(e) => setObservacionesModal(prev => ({ ...prev, texto: e.target.value }))}
                                        placeholder="Ingresá las observaciones del viaje (opcional)"
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeObservaciones} disabled={observacionesModal.loading}>
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-primary"
                                    onClick={guardarObservaciones}
                                    disabled={observacionesModal.loading}
                                >
                                    {observacionesModal.loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

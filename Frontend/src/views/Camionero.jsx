import { useEffect, useMemo, useRef, useState } from 'react';
import PageHeader from '../components/UI/PageHeader';
import api from '../services/api';
import EmptyState from '../components/UI/EmptyState';
import { useToast } from '../context/ToastContext';
import { downloadCSV } from '../utils/csv';
import { generarListadoViajesPDF, generarDetalleViajePDF } from '../utils/pdf';

// Función segura para parsear números sin importar el formato local
const safeParseNumber = (val) => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    // Remover espacios
    let clean = str.replace(/\s/g, '');
    // Si tiene coma y punto, determinar cuál es separador decimal vs miles
    const lastComma = clean.lastIndexOf(',');
    const lastDot = clean.lastIndexOf('.');
    if (lastComma > -1 && lastDot > -1) {
        // Ambos existen - el último es decimal
        if (lastComma > lastDot) {
            // Formato: 1.234,56 (español)
            clean = clean.replace(/\./g, '').replace(',', '.');
        } else {
            // Formato: 1,234.56 (inglés)
            clean = clean.replace(/,/g, '');
        }
    } else if (lastComma > -1 && lastComma === clean.length - 3) {
        // Formato: 1234,56 (español sin miles)
        clean = clean.replace(',', '.');
    } else if (lastDot > -1 && lastDot === clean.length - 3) {
        // Formato: 1234.56 (inglés sin miles) - mantener como está
    } else if (lastComma > -1) {
        // Solo coma - probablemente es decimal
        clean = clean.replace(',', '.');
    }
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

export default function Camionero() {
    const [pendientes, setPendientes] = useState([]);
    const [mios, setMios] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [finalizarData, setFinalizarData] = useState({ km: '', kilosCargados: '', importe: '' });
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
    // Estado para mes de exportación
    const [mesExportacion, setMesExportacion] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    });
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

    // Adelantos del mes
    const [adelantos, setAdelantos] = useState([]);
    const [adelantosLoading, setAdelantosLoading] = useState(false);

    // Estadías del mes
    const [estadias, setEstadias] = useState([]);
    const [estadiasLoading, setEstadiasLoading] = useState(false);
    const [showEstadiaModal, setShowEstadiaModal] = useState(false);
    const [estadiaForm, setEstadiaForm] = useState({
        fechaInicio: '',
        fechaFin: '',
        monto: '',
        descripcion: ''
    });
    const [estadiaSubmitting, setEstadiaSubmitting] = useState(false);

    // Combustible del mes
    const [combustibleCargas, setCombustibleCargas] = useState([]);
    const [combustibleLoading, setCombustibleLoading] = useState(false);
    const [showCombustibleModal, setShowCombustibleModal] = useState(false);
    const [combustibleSubmitting, setCombustibleSubmitting] = useState(false);
    const [combustibleForm, setCombustibleForm] = useState({
        fechaCarga: new Date().toISOString().slice(0, 10),
        litros: '',
        precioUnitario: '',
        origen: 'externo',
        camionId: '',
        observaciones: ''
    });


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

    const fetchAdelantos = async () => {
        try {
            setAdelantosLoading(true);
            const d = new Date();
            const mesActual = String(d.getMonth() + 1).padStart(2, '0');
            const anioActual = String(d.getFullYear());
            const { data } = await api.get(`/adelantos/mis-adelantos?mes=${mesActual}&anio=${anioActual}`);
            setAdelantos(data.adelantos || []);
        } catch (e) {
            console.error('Error cargando adelantos:', e?.message);
            setAdelantos([]);
        } finally {
            setAdelantosLoading(false);
        }
    };

    const fetchEstadias = async () => {
        try {
            setEstadiasLoading(true);
            const d = new Date();
            const mesActual = String(d.getMonth() + 1).padStart(2, '0');
            const anioActual = String(d.getFullYear());
            const { data } = await api.get(`/estadias/mis-estadias?mes=${mesActual}&anio=${anioActual}`);
            setEstadias(data?.estadias || []);
        } catch (e) {
            console.error('Error cargando estadías:', e?.message);
            setEstadias([]);
        } finally {
            setEstadiasLoading(false);
        }
    };

    const fetchCombustibleCargas = async () => {
        try {
            setCombustibleLoading(true);
            const d = new Date();
            const mesActual = String(d.getMonth() + 1).padStart(2, '0');
            const anioActual = String(d.getFullYear());
            const { data } = await api.get(`/combustible/mis-cargas?mes=${mesActual}&anio=${anioActual}`);
            setCombustibleCargas(data?.cargas || []);
        } catch (e) {
            console.error('Error cargando combustible:', e?.message);
            setCombustibleCargas([]);
        } finally {
            setCombustibleLoading(false);
        }
    };

    const handleCrearEstadia = async (e) => {
        e.preventDefault();
        if (!estadiaForm.fechaInicio || !estadiaForm.fechaFin || !estadiaForm.monto) {
            showToast('Por favor completa todos los campos', 'warning');
            return;
        }
        try {
            setEstadiaSubmitting(true);
            const payload = {
                fechaInicio: estadiaForm.fechaInicio,
                fechaFin: estadiaForm.fechaFin,
                monto: safeParseNumber(estadiaForm.monto),
                descripcion: estadiaForm.descripcion || ''
            };
            await api.post('/estadias', payload);
            showToast('Estadía registrada exitosamente', 'success');
            setEstadiaForm({ fechaInicio: '', fechaFin: '', monto: '', descripcion: '' });
            setShowEstadiaModal(false);
            await fetchEstadias();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error registrando estadía';
            showToast(msg, 'error');
        } finally {
            setEstadiaSubmitting(false);
        }
    };

    const handleEliminarEstadia = async (id) => {
        if (!confirm('¿Eliminar esta estadía?')) return;
        try {
            await api.delete(`/estadias/${id}`);
            showToast('Estadía eliminada', 'success');
            await fetchEstadias();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error eliminando estadía';
            showToast(msg, 'error');
        }
    };

    const handleCrearCargaCombustible = async (e) => {
        e.preventDefault();

        const requierePrecioCamionero = combustibleForm.origen === 'externo';
        if (!combustibleForm.fechaCarga || !combustibleForm.litros || (requierePrecioCamionero && !combustibleForm.precioUnitario) || !combustibleForm.camionId) {
            showToast(
                requierePrecioCamionero
                    ? 'Completá fecha, camión, litros y precio unitario'
                    : 'Completá fecha, camión y litros',
                'warning'
            );
            return;
        }

        try {
            setCombustibleSubmitting(true);
            await api.post('/combustible/cargas', {
                fechaCarga: combustibleForm.fechaCarga,
                litros: safeParseNumber(combustibleForm.litros),
                precioUnitario: requierePrecioCamionero ? safeParseNumber(combustibleForm.precioUnitario) : 0,
                origen: combustibleForm.origen,
                camionId: Number(combustibleForm.camionId),
                observaciones: combustibleForm.observaciones || ''
            });

            showToast(
                combustibleForm.origen === 'predio'
                    ? 'Carga registrada y descontada del predio'
                    : 'Carga de combustible registrada',
                'success'
            );

            setCombustibleForm({
                fechaCarga: new Date().toISOString().slice(0, 10),
                litros: '',
                precioUnitario: '',
                origen: 'externo',
                camionId: '',
                observaciones: ''
            });
            setShowCombustibleModal(false);
            await fetchCombustibleCargas();
        } catch (e) {
            const msg = e?.response?.data?.error || 'Error registrando combustible';
            showToast(msg, 'error');
        } finally {
            setCombustibleSubmitting(false);
        }
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try { await Promise.all([fetchPendientes(), fetchMios(), fetchAdelantos(), fetchEstadias(), fetchCombustibleCargas()]); }
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

    // Viaje en curso actual (normalmente hay 1). Tomamos el más reciente por fecha.
    const viajeEnCursoActual = useMemo(() => {
        const enCurso = mios.filter(v => v.estado === 'en curso');
        if (enCurso.length === 0) return null;
        return enCurso.sort((a, b) => parseDateOnlyLocal(b.fecha || 0) - parseDateOnlyLocal(a.fecha || 0))[0];
    }, [mios]);

    const camionesDisponiblesCombustible = useMemo(() => {
        const map = new Map();
        [...pendientes, ...mios].forEach((v) => {
            const id = v?.camion?.id || v?.camionId;
            if (!id) return;
            if (!map.has(id)) {
                map.set(id, {
                    id,
                    patente: v?.camion?.patente || `Camión #${id}`
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => String(a.patente).localeCompare(String(b.patente)));
    }, [pendientes, mios]);

    useEffect(() => {
        if (!showCombustibleModal || !viajeEnCursoActual) return;
        const camionId = viajeEnCursoActual?.camion?.id || viajeEnCursoActual?.camionId || '';
        if (!camionId) return;
        setCombustibleForm((prev) => ({ ...prev, camionId: String(camionId) }));
    }, [showCombustibleModal, viajeEnCursoActual]);

    const viajeSeleccionado = useMemo(() => mios.find(v => v.id === modalId) || null, [mios, modalId]);

    const openFinalizarModal = (id) => {
        setModalId(id);
        setFinalizarData({ km: '', kilosCargados: '', importe: '' });
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
            if (String(finalizarData.km).trim() === '') {
                showToast('Completá km', 'error');
                return;
            }
            // Validar datos mínimos antes de pasar a confirmación
            const kmNum = safeParseNumber(finalizarData.km);
            if (isNaN(kmNum) || kmNum <= 0) {
                showToast('Ingresá KM mayor a 0', 'error');
                return;
            }
            setFinalizarPasoConfirm(true);
            return;
        }
        // Segunda pulsación: enviar
        setFinishingId(id);
        try {
            const body = { km: safeParseNumber(finalizarData.km), combustible: 0, importe: safeParseNumber(finalizarData.importe) };
            if (String(finalizarData.kilosCargados).trim() !== '') body.kilosCargados = safeParseNumber(finalizarData.kilosCargados);
            await api.patch(`/viajes/${id}/finalizar`, body);
            setFinalizarData({ km: '', kilosCargados: '', importe: '' });
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

    // Exportar viajes pendientes a PDF
    const exportPendientesPDF = () => {
        try {
            const [anio, mes] = mesExportacion.split('-');
            const viajesMes = pendientesOrdenados.filter(v => {
                if (!v.fecha) return false;
                const [vAno, vMes] = String(v.fecha).split('-');
                return vAno === anio && vMes === mes;
            });

            const mesNombre = new Date(mesExportacion + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const titulo = `Viajes Pendientes - ${mesNombre}`;
            const headers = ['Fecha', 'Origen', 'Destino', 'Tipo', 'Cliente', 'Camión'];
            const rows = viajesMes.map(v => [
                formatDateOnly(v.fecha),
                v.origen || '-',
                v.destino || '-',
                v.tipoMercaderia || '-',
                v.cliente || '-',
                v.camion?.patente || v.camionId || '-'
            ]);
            generarListadoViajesPDF(titulo, headers, rows, 'pendientes.pdf', viajesMes);
            showToast(`PDF de pendientes generado (${viajesMes.length} viajes)`, 'success');
        } catch (e) {
            showToast('Error al exportar PDF', 'error');
        }
    };

    // Exportar mis viajes a PDF
    const exportMiosViajesPDF = () => {
        try {
            const [anio, mes] = mesExportacion.split('-');
            const viajesMes = miosOrdenados.filter(v => {
                if (!v.fecha) return false;
                const [vAno, vMes] = String(v.fecha).split('-');
                return vAno === anio && vMes === mes;
            });

            const mesNombre = new Date(mesExportacion + '-01').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            const titulo = `Mis Viajes - ${estadoMios.charAt(0).toUpperCase() + estadoMios.slice(1)} (${mesNombre})`;
            const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Tipo', 'Cliente', 'Camión', 'Km', 'Combustible', 'Toneladas', 'Importe'];
            const rows = viajesMes.map(v => [
                formatDateOnly(v.fecha),
                v.estado || '-',
                v.origen || '-',
                v.destino || '-',
                v.tipoMercaderia || '-',
                v.cliente || '-',
                v.camion?.patente || v.camionId || '-',
                v.km ?? '-',
                v.combustible ?? '-',
                v.kilosCargados ?? '-',
                v.importe ?? '-'
            ]);
            generarListadoViajesPDF(titulo, headers, rows, `mis_viajes_${estadoMios}.pdf`, viajesMes);
            showToast(`PDF de mis viajes generado (${viajesMes.length} viajes)`, 'success');
        } catch (e) {
            showToast('Error al exportar PDF', 'error');
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

            {/* Tarjeta de Adelantos */}
            {adelantosLoading ? (
                <div className="card shadow-sm">
                    <div className="card-body text-center">
                        <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                    </div>
                </div>
            ) : adelantos.length > 0 ? (
                <div className="card shadow-sm border-success">
                    <div className="card-header bg-success bg-opacity-10 d-flex align-items-center gap-2 py-2">
                        <i className="bi bi-cash-coin text-success" style={{ fontSize: '1.25rem' }}></i>
                        <h6 className="mb-0 fw-bold">Adelantos del Mes - {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h6>
                    </div>
                    <div className="card-body">
                        <div className="table-responsive">
                            <table className="table table-sm table-borderless mb-0">
                                <tbody>
                                    {adelantos.map(adelanto => (
                                        <tr key={adelanto.id} className="border-bottom">
                                            <td className="py-3" style={{ width: '40%' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    <div className="bg-success bg-opacity-10 rounded p-2">
                                                        <i className="bi bi-currency-dollar text-success"></i>
                                                    </div>
                                                    <div>
                                                        <div className="fw-bold text-success" style={{ fontSize: '1.1rem' }}>
                                                            ${safeParseNumber(adelanto.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </div>
                                                        <small className="text-muted">
                                                            {new Date(adelanto.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}
                                                        </small>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3 text-muted">
                                                {adelanto.descripcion || 'Adelanto registrado por administración'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 p-3 bg-light rounded d-flex justify-content-between align-items-center">
                            <div>
                                <small className="text-muted d-block mb-1">Total adelantado en {new Date().toLocaleString('es-AR', { month: 'long' })}</small>
                                <h4 className="mb-0 text-success fw-bold">
                                    ${adelantos.reduce((sum, a) => sum + parseFloat(a.monto || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </h4>
                            </div>
                            <div className="text-end">
                                <small className="text-muted">
                                    <i className="bi bi-info-circle me-1"></i>
                                    Se reinicia cada mes
                                </small>
                            </div>
                        </div>
                    </div>
                </div>
            ) : null}

            {/* Tarjeta de Estadías */}
            <div className="card shadow-sm border-info">
                <div className="card-header bg-info bg-opacity-10 d-flex align-items-center gap-2 py-2">
                    <i className="bi bi-house-door text-info" style={{ fontSize: '1.25rem' }}></i>
                    <h6 className="mb-0 fw-bold">Estadías del Mes - {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h6>
                    <div className="ms-auto">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => setShowEstadiaModal(true)}>
                            <i className="bi bi-plus-lg me-1"></i> Registrar estadía
                        </button>
                    </div>
                </div>
                <div className="card-body">
                    {estadiasLoading ? (
                        <div className="text-center">
                            <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                        </div>
                    ) : estadias.length > 0 ? (
                        <>
                            <div className="table-responsive">
                                <table className="table table-sm table-borderless mb-0">
                                    <tbody>
                                        {estadias.map(estadia => (
                                            <tr key={estadia.id} className="border-bottom">
                                                <td className="py-3" style={{ width: '40%' }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-info bg-opacity-10 rounded p-2">
                                                            <i className="bi bi-calendar-event text-info"></i>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-info" style={{ fontSize: '1.1rem' }}>
                                                                ${safeParseNumber(estadia.monto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </div>
                                                            <small className="text-muted">
                                                                {formatDateOnly(estadia.fechaInicio)} → {formatDateOnly(estadia.fechaFin)}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-muted">
                                                    {estadia.descripcion || 'Estadía registrada'}
                                                </td>
                                                <td className="py-3 text-end">
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => handleEliminarEstadia(estadia.id)}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 p-3 bg-light rounded d-flex justify-content-between align-items-center">
                                <div>
                                    <small className="text-muted d-block mb-1">Total en {new Date().toLocaleString('es-AR', { month: 'long' })}</small>
                                    <h4 className="mb-0 text-info fw-bold">
                                        ${estadias.reduce((sum, e) => sum + parseFloat(e.monto || 0), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </h4>
                                </div>
                                <div className="text-end">
                                    <small className="text-muted">
                                        <i className="bi bi-info-circle me-1"></i>
                                        Se reinicia cada mes
                                    </small>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-muted py-2">
                            No hay estadías registradas este mes.
                        </div>
                    )}
                </div>
            </div>

            <div className="card shadow-sm border-warning">
                <div className="card-header bg-warning bg-opacity-10 d-flex align-items-center gap-2 py-2">
                    <i className="bi bi-fuel-pump text-warning" style={{ fontSize: '1.25rem' }}></i>
                    <h6 className="mb-0 fw-bold">Combustible del Mes - {new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' })}</h6>
                    <div className="ms-auto">
                        <button className="btn btn-sm btn-outline-warning" onClick={() => setShowCombustibleModal(true)}>
                            <i className="bi bi-plus-lg me-1"></i> Registrar combustible
                        </button>
                    </div>
                </div>
                <div className="card-body">
                    {combustibleLoading ? (
                        <div className="text-center">
                            <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                        </div>
                    ) : combustibleCargas.length > 0 ? (
                        <>
                            <div className="table-responsive">
                                <table className="table table-sm table-borderless mb-0">
                                    <tbody>
                                        {combustibleCargas.map((carga) => (
                                            <tr key={carga.id} className="border-bottom">
                                                <td className="py-3" style={{ width: '38%' }}>
                                                    <div className="d-flex align-items-center gap-2">
                                                        <div className="bg-warning bg-opacity-10 rounded p-2">
                                                            <i className="bi bi-droplet-half text-warning"></i>
                                                        </div>
                                                        <div>
                                                            <div className="fw-bold text-warning-emphasis" style={{ fontSize: '1.1rem' }}>
                                                                {safeParseNumber(carga.litros).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                                                            </div>
                                                            <small className="text-muted">{formatDateOnly(carga.fechaCarga)}</small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-3 text-muted" style={{ width: '42%' }}>
                                                    <div><strong>Camión:</strong> {carga?.camion?.patente || '-'}</div>
                                                    <div><strong>Lugar:</strong> {carga?.origen === 'predio' ? 'Carga predio' : 'Carga externa'}</div>
                                                    <div><strong>Observaciones:</strong> {carga?.observaciones || '-'}</div>
                                                    <div><strong>Precio unitario:</strong> ${safeParseNumber(carga?.precioUnitario).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                    <div><strong>Total:</strong> ${safeParseNumber(carga?.importeTotal || (safeParseNumber(carga?.litros) * safeParseNumber(carga?.precioUnitario))).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                                                </td>
                                                <td className="py-3 text-end" style={{ width: '20%' }}>
                                                    <span className={`badge ${carga?.origen === 'predio' ? 'text-bg-primary' : 'text-bg-secondary'}`}>
                                                        {carga?.origen === 'predio' ? 'Predio' : 'Externo'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="mt-3 p-3 bg-light rounded d-flex justify-content-between align-items-center">
                                <div>
                                    <small className="text-muted d-block mb-1">Total cargado en {new Date().toLocaleString('es-AR', { month: 'long' })}</small>
                                    <h4 className="mb-0 text-warning-emphasis fw-bold">
                                        {combustibleCargas.reduce((sum, c) => sum + safeParseNumber(c.litros), 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                                    </h4>
                                </div>
                                <div className="text-end">
                                    <small className="text-muted">
                                        <i className="bi bi-info-circle me-1"></i>
                                        Cargas registradas por camión
                                    </small>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-center text-muted py-2">No hay cargas de combustible registradas este mes.</div>
                    )}
                </div>
            </div>

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
                        <div style={{ minWidth: '130px' }}>
                            <label className="form-label form-label-sm mb-1">Mes</label>
                            <input
                                type="month"
                                className="form-control form-control-sm"
                                value={mesExportacion}
                                onChange={e => setMesExportacion(e.target.value)}
                            />
                        </div>
                        <div className="ms-auto">
                            <button className="btn btn-sm btn-outline-secondary" onClick={exportPendientesPDF} title="Exportar a PDF">
                                <i className="bi bi-filetype-pdf me-1"></i> PDF
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
                                            <td title={v.origen}>{v.origen}</td>
                                            <td title={v.destino}>{v.destino}</td>
                                            <td title={v.tipoMercaderia || ''}>{v.tipoMercaderia || '-'}</td>
                                            <td title={v.cliente || ''}>{v.cliente || '-'}</td>
                                            <td title={v.camion ? `${v.camion.patente} • ${v.camion.marca} ${v.camion.modelo}` : v.camionId}>
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
                        <div style={{ minWidth: '130px' }}>
                            <label className="form-label form-label-sm mb-1">Mes</label>
                            <input
                                type="month"
                                className="form-control form-control-sm"
                                value={mesExportacion}
                                onChange={e => setMesExportacion(e.target.value)}
                            />
                        </div>
                        <div className="ms-auto">
                            <button className="btn btn-sm btn-outline-secondary" onClick={exportMiosViajesPDF} title="Exportar a PDF">
                                <i className="bi bi-filetype-pdf me-1"></i> PDF
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
                                            <td title={v.origen}>{v.origen}</td>
                                            <td title={v.destino}>{v.destino}</td>
                                            <td title={v.tipoMercaderia || ''}>{v.tipoMercaderia || '-'}</td>
                                            <td title={v.cliente || ''}>{v.cliente || '-'}</td>
                                            <td title={v.camion?.patente || v.camionId}>{v.camion?.patente || v.camionId}</td>
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
                                    <div className="col-12">
                                        <label className="form-label">Toneladas cargadas</label>
                                        <input className="form-control" type="number" min={0} step={1} value={finalizarData.kilosCargados} onChange={e => setFinalizarData(x => ({ ...x, kilosCargados: e.target.value }))} />
                                    </div>
                                    <div className="col-12">
                                        <label className="form-label">Importe</label>
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
                                        <li><strong>Toneladas a registrar:</strong> {finalizarData.kilosCargados || '—'}</li>
                                        <li><strong>Importe a registrar:</strong> {finalizarData.importe || '—'}</li>
                                        <li><strong>Viaje:</strong> #{viajeSeleccionado?.id} {viajeSeleccionado?.origen} → {viajeSeleccionado?.destino}</li>
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
                                    <button type="button" className="btn btn-primary" disabled={!modalId || safeParseNumber(finalizarData.km) <= 0} onClick={() => modalId && finalizar(modalId)}>
                                        Continuar
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button type="button" className="btn btn-outline-secondary" onClick={() => setFinalizarPasoConfirm(false)} disabled={finishingId === modalId}>Volver</button>
                                    <button type="button" className="btn btn-danger" disabled={!modalId || finishingId === modalId || !confirmChecked || safeParseNumber(finalizarData.km) <= 0} onClick={() => modalId && finalizar(modalId)}>
                                        {finishingId === modalId ? 'Finalizando…' : 'Finalizar viaje'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {showFinalizarModal && <div className="modal-backdrop show"></div>}

            {/* Modal Estadía */}
            <div className={`modal ${showEstadiaModal ? 'show d-block' : 'fade'}`} id="modalEstadia" tabIndex="-1" aria-hidden={!showEstadiaModal}>
                <div className="modal-dialog">
                    <form className="modal-content" onSubmit={handleCrearEstadia}>
                        <div className="modal-header">
                            <h1 className="modal-title fs-5 d-flex align-items-center gap-2">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-info-subtle text-info" style={{ width: 28, height: 28 }}>
                                    <i className="bi bi-house-door"></i>
                                </span>
                                <span>Registrar estadía</span>
                            </h1>
                            <button type="button" className="btn-close" onClick={() => setShowEstadiaModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            <div className="row g-2">
                                <div className="col-6">
                                    <label className="form-label">Fecha inicio</label>
                                    <input
                                        className="form-control"
                                        type="date"
                                        value={estadiaForm.fechaInicio}
                                        onChange={e => setEstadiaForm(x => ({ ...x, fechaInicio: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Fecha fin</label>
                                    <input
                                        className="form-control"
                                        type="date"
                                        min={estadiaForm.fechaInicio || undefined}
                                        value={estadiaForm.fechaFin}
                                        onChange={e => setEstadiaForm(x => ({ ...x, fechaFin: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Monto</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={estadiaForm.monto}
                                        onChange={e => setEstadiaForm(x => ({ ...x, monto: e.target.value }))}
                                        placeholder="Ej: 25000"
                                        required
                                    />
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Descripción (opcional)</label>
                                    <input
                                        className="form-control"
                                        type="text"
                                        value={estadiaForm.descripcion}
                                        onChange={e => setEstadiaForm(x => ({ ...x, descripcion: e.target.value }))}
                                        placeholder="Hotel, parador, etc."
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowEstadiaModal(false)}>Cancelar</button>
                            <button type="submit" className="btn btn-primary" disabled={estadiaSubmitting}>
                                {estadiaSubmitting ? 'Guardando…' : 'Guardar estadía'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {showEstadiaModal && <div className="modal-backdrop show"></div>}

            <div className={`modal ${showCombustibleModal ? 'show d-block' : 'fade'}`} id="modalCombustible" tabIndex="-1" aria-hidden={!showCombustibleModal}>
                <div className="modal-dialog">
                    <form className="modal-content" onSubmit={handleCrearCargaCombustible}>
                        <div className="modal-header">
                            <h1 className="modal-title fs-5 d-flex align-items-center gap-2">
                                <span className="d-inline-flex align-items-center justify-content-center rounded-circle bg-warning-subtle text-warning" style={{ width: 28, height: 28 }}>
                                    <i className="bi bi-fuel-pump"></i>
                                </span>
                                <span>Registrar carga de combustible</span>
                            </h1>
                            <button type="button" className="btn-close" onClick={() => setShowCombustibleModal(false)}></button>
                        </div>
                        <div className="modal-body">
                            <div className="row g-2">
                                <div className="col-6">
                                    <label className="form-label">Fecha de carga</label>
                                    <input
                                        className="form-control"
                                        type="date"
                                        value={combustibleForm.fechaCarga}
                                        onChange={e => setCombustibleForm(x => ({ ...x, fechaCarga: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Camión</label>
                                    <select
                                        className="form-select"
                                        value={combustibleForm.camionId}
                                        onChange={e => setCombustibleForm(x => ({ ...x, camionId: e.target.value }))}
                                        required
                                    >
                                        <option value="">Seleccioná camión</option>
                                        {camionesDisponiblesCombustible.map((camion) => (
                                            <option key={camion.id} value={camion.id}>{camion.patente}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Litros</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        min={0.01}
                                        step={0.01}
                                        value={combustibleForm.litros}
                                        onChange={e => setCombustibleForm(x => ({ ...x, litros: e.target.value }))}
                                        placeholder="Ej: 180"
                                        required
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Precio Unitario {combustibleForm.origen === 'predio' ? '(lo define CEO)' : ''}</label>
                                    <input
                                        className="form-control"
                                        type="number"
                                        min={0.01}
                                        step={0.01}
                                        value={combustibleForm.precioUnitario}
                                        onChange={e => setCombustibleForm(x => ({ ...x, precioUnitario: e.target.value }))}
                                        placeholder={combustibleForm.origen === 'predio' ? 'Se aplica el precio de predio' : 'Ej: 1350'}
                                        required={combustibleForm.origen === 'externo'}
                                        disabled={combustibleForm.origen === 'predio'}
                                    />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Origen</label>
                                    <select
                                        className="form-select"
                                        value={combustibleForm.origen}
                                        onChange={e => setCombustibleForm(x => ({ ...x, origen: e.target.value }))}
                                    >
                                        <option value="externo">Carga externa</option>
                                        <option value="predio">Carga en predio (descuenta stock)</option>
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">Observaciones</label>
                                    <input
                                        className="form-control"
                                        type="text"
                                        value={combustibleForm.observaciones}
                                        onChange={e => setCombustibleForm(x => ({ ...x, observaciones: e.target.value }))}
                                        placeholder="Ej: YPF Ruta 9 Km 700"
                                    />
                                </div>
                                <div className="col-12">
                                    <div className="alert alert-light border mb-0 py-2">
                                        <small className="text-muted d-block">
                                            {combustibleForm.origen === 'predio'
                                                ? 'Total estimado: se calcula con el precio unitario de predio (CEO)'
                                                : 'Total de la carga (litros × precio unitario)'}
                                        </small>
                                        <strong>
                                            {combustibleForm.origen === 'predio'
                                                ? 'Se calculará al guardar'
                                                : `$${(safeParseNumber(combustibleForm.litros) * safeParseNumber(combustibleForm.precioUnitario)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={() => setShowCombustibleModal(false)}>Cancelar</button>
                            <button type="submit" className="btn btn-warning" disabled={combustibleSubmitting}>
                                {combustibleSubmitting ? 'Guardando…' : 'Guardar carga'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            {showCombustibleModal && <div className="modal-backdrop show"></div>}

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
                                        <div><strong>Adelanto:</strong> -${safeParseNumber(liqRes.adelanto || 0).toFixed(2)}</div>
                                        <div className="text-success"><strong>Estadia:</strong> +${safeParseNumber(liqRes.totalEstadia || 0).toFixed(2)}</div>
                                        <div className="border-top pt-2 mt-2"><strong>Neto:</strong> ${liqRes.neto?.toFixed ? liqRes.neto.toFixed(2) : liqRes.neto}</div>
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
                                                {[...(liqRes.viajes || [])].sort((a, b) => parseDateOnlyLocal(b.fecha) - parseDateOnlyLocal(a.fecha)).map(v => (
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
                                    {liqRes.estadias && liqRes.estadias.length > 0 && (
                                        <div className="mt-3">
                                            <h6 className="text-muted mb-2">Estadías registradas</h6>
                                            <div className="table-responsive">
                                                <table className="table table-sm table-striped">
                                                    <thead>
                                                        <tr>
                                                            <th>Inicio</th>
                                                            <th>Fin</th>
                                                            <th>Monto</th>
                                                            <th>Descripción</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {[...(liqRes.estadias || [])].sort((a, b) => parseDateOnlyLocal(b.fechaInicio) - parseDateOnlyLocal(a.fechaInicio)).map(e => (
                                                            <tr key={e.id}>
                                                                <td>{formatDateOnly(e.fechaInicio)}</td>
                                                                <td>{formatDateOnly(e.fechaFin)}</td>
                                                                <td>${safeParseNumber(e.monto || 0).toFixed(2)}</td>
                                                                <td className="text-muted small">{e.descripcion || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    )}
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

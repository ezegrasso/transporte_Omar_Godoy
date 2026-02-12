import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import PageHeader from '../components/UI/PageHeader';
import StatCard from '../components/UI/StatCard';
import { useAuth } from '../context/AuthContext';
import api, { downloadFactura } from '../services/api';
import EmptyState from '../components/UI/EmptyState';
// Migración de exportación: reemplazamos CSV por PDF y añadimos detalle/factura
import { generarListadoViajesPDF, generarDetalleViajePDF, generarFacturaViajePDF } from '../utils/pdf';
import { SkeletonText } from '../components/UI/Skeleton';
import { ConfirmModal } from '../components/UI/ConfirmModal';
import { useToast } from '../context/ToastContext';
import DashboardCharts from '../components/UI/DashboardCharts';
import Ceo from './Ceo';

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

// Función para formatear moneda con formato español (1.234,56)
// Función para formatear moneda con formato español (1.234,56)
const formatearMoneda = (numero) => {
    try {
        const n = parseFloat(numero);
        if (isNaN(n) || !isFinite(n)) return '0,00';

        const redondeado = Math.round(n * 100) / 100;
        const partes = redondeado.toFixed(2).split('.');
        const entero = partes[0];
        const decimales = partes[1];

        // Agregar puntos como separador de miles
        const enteroFormateado = entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${enteroFormateado},${decimales}`;
    } catch (err) {
        return '0,00';
    }
};

export default function Administracion() {
    // Portal ref para el menú de acciones (separa del DOM directo para evitar errores de extensiones)
    const portalRef = useRef(null);
    useEffect(() => {
        portalRef.current = document.createElement('div');
        try {
            document.body.appendChild(portalRef.current);
        } catch (e) {
            console.warn('[Portal] No se pudo agregar portal:', e?.message);
        }
        return () => {
            if (portalRef.current && portalRef.current.parentNode) {
                try {
                    portalRef.current.parentNode.removeChild(portalRef.current);
                } catch (e) {
                    // Silenciar error si la extensión ya manipuló el DOM
                }
            }
        };
    }, []);

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
    const [rowMenuPos, setRowMenuPos] = useState({ topDown: 0, topUp: 0, left: 0, right: 0 });
    const [rowMenuPlacement, setRowMenuPlacement] = useState({ v: 'down', h: 'right' });
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
    const [facturaModal, setFacturaModal] = useState({ open: false, id: null, estado: 'pendiente', fecha: '', precioUnitario: '', precioUnitarioNegro: '', ivaPercentaje: 0, file: null, loading: false, error: '' });
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
            precioUnitario: v.precioUnitarioFactura ?? v.importe ?? '',
            precioUnitarioNegro: v.precioUnitarioNegro ?? '',
            ivaPercentaje: v.ivaPercentaje || 0,
            file: null,
            loading: false,
            error: ''
        });
    };
    const closeFactura = () => setFacturaModal({ open: false, id: null, estado: 'pendiente', fecha: '', precioUnitario: '', precioUnitarioNegro: '', ivaPercentaje: 0, file: null, loading: false, error: '' });
    const submitFactura = async () => {
        if (!facturaModal.id) return;
        console.log('[submitFactura] file:', facturaModal.file);
        console.log('[submitFactura] usando:', facturaModal.file ? 'POST' : 'PATCH');
        setFacturaModal((m) => ({ ...m, loading: true, error: '' }));
        try {
            // Si hay archivo, POST multipart; si no, PATCH solo estado/fecha
            if (facturaModal.file) {
                const fd = new FormData();
                fd.append('file', facturaModal.file);
                if (facturaModal.estado) fd.append('facturaEstado', facturaModal.estado);
                if (facturaModal.fecha) fd.append('fechaFactura', facturaModal.fecha);
                if (String(facturaModal.precioUnitario).trim() !== '') fd.append('precioUnitario', String(facturaModal.precioUnitario));
                fd.append('ivaPercentaje', facturaModal.ivaPercentaje);
                await api.post(`/viajes/${facturaModal.id}/factura`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            } else {
                await api.patch(`/viajes/${facturaModal.id}/factura`, {
                    facturaEstado: facturaModal.estado,
                    fechaFactura: facturaModal.fecha || null,
                    precioUnitario: String(facturaModal.precioUnitario || '').trim() !== '' ? safeParseNumber(facturaModal.precioUnitario) : undefined,
                    precioUnitarioNegro: String(facturaModal.precioUnitarioNegro || '').trim() !== '' ? safeParseNumber(facturaModal.precioUnitarioNegro) : undefined,
                    ivaPercentaje: facturaModal.ivaPercentaje,
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
    const [checkingVencidas, setCheckingVencidas] = useState(false);
    const openUploadRemitos = (v) => setRemitosUploadModal({ open: true, id: v.id, files: [], loading: false, error: '' });
    const closeUploadRemitos = () => setRemitosUploadModal({ open: false, id: null, files: [], loading: false, error: '' });
    const [creditNoteModal, setCreditNoteModal] = useState({ open: false, id: null, motivo: '', monto: '', descripcion: '', loading: false, error: '' });
    const openCreditNote = (v) => {
        setCreditNoteModal({
            open: true,
            id: v.id,
            motivo: '',
            monto: '',
            descripcion: '',
            loading: false,
            error: ''
        });
    };
    const closeCreditNote = () => setCreditNoteModal({ open: false, id: null, motivo: '', monto: '', descripcion: '', loading: false, error: '' });
    const submitCreditNote = async () => {
        if (!creditNoteModal.id || !creditNoteModal.motivo || !creditNoteModal.monto) {
            setCreditNoteModal(m => ({ ...m, error: 'Completa motivo y monto' }));
            return;
        }
        setCreditNoteModal(m => ({ ...m, loading: true, error: '' }));
        try {
            await api.post(`/viajes/${creditNoteModal.id}/nota-credito`, {
                motivo: creditNoteModal.motivo,
                monto: safeParseNumber(creditNoteModal.monto),
                descripcion: creditNoteModal.descripcion || ''
            });
            showToast('Nota de crédito creada', 'success');
            closeCreditNote();
            fetchSemana();
        } catch (e) {
            setCreditNoteModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error al crear nota de crédito' }));
        }
    };

    // Modal: Resumen Financiero Mensual
    const [finanzasModal, setFinanzasModal] = useState({ open: false, mes: '', clienteFiltro: 'todos' });
    const [detalleClienteModal, setDetalleClienteModal] = useState({ open: false, cliente: '', viajes: [] });
    const openFinanzas = () => {
        const obtenerMesDefault = () => {
            try {
                const base = (viajes || []).filter(v => v?.fecha);
                if (base.length > 0) {
                    const last = base
                        .slice()
                        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];
                    const [y, m] = String(last.fecha).split('-');
                    if (y && m) return `${y}-${m}`;
                }
            } catch { /* ignore */ }
            const hoy = new Date();
            return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
        };
        setFinanzasModal({ open: true, mes: obtenerMesDefault(), clienteFiltro: 'todos' });
    };
    const closeFinanzas = () => setFinanzasModal({ open: false, mes: '', clienteFiltro: 'todos' });

    const openDetalleCliente = (cliente) => {
        // Filtrar viajes del mes y cliente seleccionado
        const viajesCliente = (viajesMesFinanzas || [])
            .filter(v => (v.estado || '').toLowerCase() === 'finalizado' && v.cliente === cliente)
            .sort((a, b) => String(a.fecha || '').localeCompare(String(b.fecha || '')));

        setDetalleClienteModal({ open: true, cliente, viajes: viajesCliente });
    };

    const closeDetalleCliente = (e) => {
        if (e) {
            e.stopPropagation();
            if (e.nativeEvent) e.nativeEvent.stopImmediatePropagation();
        }
        setDetalleClienteModal({ open: false, cliente: '', viajes: [] });
    };

    // Estados para adelantos
    const [camioneros, setCamioneros] = useState([]);
    const [adelantoModal, setAdelantoModal] = useState({ open: false, camioneroId: null, camioneroNombre: '', monto: '', descripcion: '', mes: '', anio: '', loading: false, error: '' });
    const [gestionAdelantosModal, setGestionAdelantosModal] = useState({ open: false, adelantos: [], loading: false, editando: null, montoEdit: '', descripcionEdit: '' });

    // Funciones para adelantos
    const fetchCamioneros = async () => {
        try {
            const response = await api.get('/usuarios?rol=camionero');
            console.log('[fetchCamioneros] response:', response);
            const { data } = response;
            // Si data es un array, usar directamente; si es un objeto con propiedad data, usar esa
            const camionerosList = Array.isArray(data) ? data : (data.data || []);
            console.log('[fetchCamioneros] camionerosList:', camionerosList);
            setCamioneros(camionerosList);
        } catch (e) {
            console.error('Error cargando camioneros', e);
            setCamioneros([]);
        }
    };

    const openAdelantoModal = (camioneroId = null, camioneroNombre = '') => {
        const hoy = new Date();
        const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
        const anioActual = hoy.getFullYear();
        setAdelantoModal({
            open: true,
            camioneroId,
            camioneroNombre,
            monto: '',
            descripcion: '',
            mes: mesActual,
            anio: anioActual,
            loading: false,
            error: ''
        });
    };

    const closeAdelantoModal = () => setAdelantoModal({ open: false, camioneroId: null, camioneroNombre: '', monto: '', descripcion: '', mes: '', anio: '', loading: false, error: '' });

    const submitAdelanto = async () => {
        if (!adelantoModal.camioneroId) {
            setAdelantoModal(m => ({ ...m, error: 'Debes seleccionar un camionero' }));
            return;
        }
        if (!adelantoModal.monto || safeParseNumber(adelantoModal.monto) <= 0) {
            setAdelantoModal(m => ({ ...m, error: 'Ingresá un monto válido' }));
            return;
        }
        setAdelantoModal(m => ({ ...m, loading: true, error: '' }));
        try {
            await api.post('/adelantos', {
                camioneroId: adelantoModal.camioneroId,
                monto: safeParseNumber(adelantoModal.monto),
                mes: safeParseNumber(adelantoModal.mes),
                anio: safeParseNumber(adelantoModal.anio),
                descripcion: adelantoModal.descripcion || undefined
            });
            showToast('Adelanto registrado y notificado al camionero', 'success');
            closeAdelantoModal();
        } catch (e) {
            setAdelantoModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error registrando adelanto' }));
        }
    };

    const openGestionAdelantos = async () => {
        setGestionAdelantosModal({ open: true, adelantos: [], loading: true, editando: null, montoEdit: '', descripcionEdit: '' });
        try {
            // Si no hay camioneros cargados, cargarlos primero
            let cams = camioneros;
            if (!cams || cams.length === 0) {
                const { data } = await api.get('/usuarios?rol=camionero');
                cams = Array.isArray(data) ? data : (data.data || []);
            }

            const hoy = new Date();
            const mesActual = hoy.getMonth() + 1;
            const anioActual = hoy.getFullYear();

            const adelantosPromises = cams.map(async (c) => {
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
            openGestionAdelantos();
        } catch (e) {
            showToast('Error eliminando adelanto', 'error');
        }
    };

    // Cargar camioneros al montar
    useEffect(() => { fetchCamioneros(); }, []);

    // Modal: Observaciones
    const [observacionesModal, setObservacionesModal] = useState({ open: false, id: null, texto: '', loading: false, error: '' });
    const openObservaciones = (v) => {
        setObservacionesModal({ open: true, id: v.id, texto: v.observacionesAdmin || '', loading: false, error: '' });
    };
    const closeObservaciones = () => setObservacionesModal({ open: false, id: null, texto: '', loading: false, error: '' });
    const submitObservaciones = async () => {
        if (!observacionesModal.id) return;
        setObservacionesModal(m => ({ ...m, loading: true, error: '' }));
        try {
            await api.patch(`/viajes/${observacionesModal.id}/observaciones`, { observaciones: observacionesModal.texto, panel: 'administracion' });
            showToast('Observaciones guardadas', 'success');
            closeObservaciones();
            fetchSemana();
        } catch (e) {
            setObservacionesModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error al guardar observaciones' }));
        }
    };

    // Modal: Editar Importe
    const [editarImporteModal, setEditarImporteModal] = useState({ open: false, id: null, viaje: null, nuevoImporte: '', loading: false, error: '' });
    const openEditarImporte = (v) => {
        setEditarImporteModal({ open: true, id: v.id, viaje: v, nuevoImporte: v.importe || '', loading: false, error: '' });
    };
    const closeEditarImporte = () => setEditarImporteModal({ open: false, id: null, viaje: null, nuevoImporte: '', loading: false, error: '' });
    const submitEditarImporte = async () => {
        if (!editarImporteModal.id) return;
        setEditarImporteModal(m => ({ ...m, loading: true, error: '' }));
        try {
            await api.patch(`/viajes/${editarImporteModal.id}/editar-importe`, { importe: safeParseNumber(editarImporteModal.nuevoImporte) });
            showToast('Importe actualizado', 'success');
            closeEditarImporte();
            fetchSemana();
        } catch (e) {
            setEditarImporteModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error al actualizar importe' }));
        }
    };

    // Modal: Finalizar viaje
    const [finalizarModal, setFinalizarModal] = useState({ open: false, id: null, km: '', combustible: '', kilos: '', loading: false, error: '' });
    const openFinalizar = (v) => {
        setFinalizarModal({
            open: true,
            id: v.id,
            km: v.kmFinal || '',
            combustible: v.combustibleConsumido || '',
            kilos: v.kilosCargados || '',
            loading: false,
            error: ''
        });
    };
    const closeFinalizar = () => setFinalizarModal({ open: false, id: null, km: '', combustible: '', kilos: '', loading: false, error: '' });
    const submitFinalizar = async () => {
        if (!finalizarModal.id) return;
        setFinalizarModal(m => ({ ...m, loading: true, error: '' }));
        try {
            await api.patch(`/viajes/${finalizarModal.id}/finalizar`, {
                kmFinal: safeParseNumber(finalizarModal.km) || 0,
                combustibleConsumido: safeParseNumber(finalizarModal.combustible) || 0,
                kilosCargados: safeParseNumber(finalizarModal.kilos) || 0
            });
            showToast('Viaje finalizado correctamente', 'success');
            closeFinalizar();
            fetchSemana();
        } catch (e) {
            setFinalizarModal(m => ({ ...m, loading: false, error: e?.response?.data?.error || 'Error al finalizar viaje' }));
        }
    };

    // Estado para viajes del modal de finanzas
    const [viajesMesFinanzas, setViajesMesFinanzas] = useState([]);
    const [loadingFinanzas, setLoadingFinanzas] = useState(false);
    const [errorFinanzas, setErrorFinanzas] = useState('');

    // Cargar viajes cuando se abre o cambia el mes en el modal de finanzas
    useEffect(() => {
        if (!finanzasModal.open || !finanzasModal.mes) return;

        const cargarViajesMes = async () => {
            setLoadingFinanzas(true);
            setErrorFinanzas('');
            try {
                const [anio, mes] = finanzasModal.mes.split('-');
                const mesPadded = String(mes).padStart(2, '0');
                const mesNum = parseInt(mesPadded);
                const anioNum = parseInt(anio);
                const lastDay = new Date(anioNum, mesNum, 0).getDate();
                const lastDayPadded = String(lastDay).padStart(2, '0');

                const from = `${anio}-${mesPadded}-01`;
                const to = `${anio}-${mesPadded}-${lastDayPadded}`;

                const { data } = await api.get(`/viajes?limit=1000&from=${from}&to=${to}&order=DESC&sortBy=fecha`);
                const viajes = data.data || data.items || [];
                setViajesMesFinanzas(viajes);
            } catch (e) {
                console.error('[cargarViajesMes] Error:', e?.response?.data || e?.message);
                setViajesMesFinanzas([]);
                setErrorFinanzas(e?.response?.data?.error || 'No se pudieron cargar los viajes del mes');
            } finally {
                setLoadingFinanzas(false);
            }
        };

        cargarViajesMes();
    }, [finanzasModal.open, finanzasModal.mes]);

    // Cálculos del resumen financiero mensual
    const datosFinanzas = useMemo(() => {
        const { clienteFiltro } = finanzasModal;

        // NO filtrar por estado - incluir todos los viajes del período
        // El resumen financiero debe mostrar TODOS los viajes, sea cual sea su estado
        const viajesMes = (viajesMesFinanzas || []);
        console.log('[datosFinanzas] viajesMesFinanzas recibidos:', viajesMes.length);
        console.log('[datosFinanzas] primeros 2 viajes:', viajesMes.slice(0, 2).map(v => ({ id: v.id, cliente: v.cliente, importe: v.importe, importeType: typeof v.importe, facturaEstado: v.facturaEstado })));

        // Filtrar por cliente y por viajes CON importe definido
        const viajesFiltro = (clienteFiltro === 'todos'
            ? viajesMes
            : viajesMes.filter(v => v.cliente === clienteFiltro))
            .filter(v => v.importe !== null && v.importe !== undefined && safeParseNumber(v.importe) > 0);

        console.log('[datosFinanzas] viajesFiltro después de filtros:', viajesFiltro.length);
        if (viajesFiltro.length > 0) {
            console.log('[datosFinanzas] primeros 2 filtrados:', viajesFiltro.slice(0, 2).map(v => ({ id: v.id, importe: v.importe, safeImporte: safeParseNumber(v.importe) })));
        }

        // Calcular totales
        let totalFacturado = 0;
        let totalPendiente = 0;
        const porCliente = {};

        viajesFiltro.forEach((v) => {
            const importeStr = v.importe;
            const importe = safeParseNumber(importeStr);
            const cliente = v.cliente || 'Sin cliente';
            const facturaEstadoRaw = v.facturaEstado || 'pendiente';
            const estado = facturaEstadoRaw.toLowerCase();

            if (!porCliente[cliente]) {
                porCliente[cliente] = { facturado: 0, pendiente: 0, cobrado: 0 };
            }

            if (estado === 'cobrada') {
                totalFacturado += importe;
                porCliente[cliente].cobrado += importe;
            } else {
                totalPendiente += importe;
                porCliente[cliente].pendiente += importe;
            }
        });

        console.log('[datosFinanzas] TOTALES FINALES:', { totalFacturado, totalPendiente, viajesProcesados: viajesFiltro.length });
        return { totalFacturado, totalPendiente, porCliente, viajesMes: viajesFiltro.length };
    }, [finanzasModal.clienteFiltro, viajesMesFinanzas]);

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


    const revisarVencidas = async () => {
        setCheckingVencidas(true);
        showToast('Revisando facturas vencidas...', 'info');
        try {
            const { data } = await api.post('/viajes/checkVencidas');
            const marcadas = data?.facturasMarcadasVencidas ?? 0;
            const notis = data?.notificacionesCreadas ?? 0;
            showToast(`Listo: ${marcadas} marcadas vencidas, ${notis} notificaciones`, 'success');
        } catch (e) {
            console.error('revisarVencidas error', e);
            showToast(e?.response?.data?.error || 'No se pudieron revisar las vencidas', 'error');
        } finally {
            setCheckingVencidas(false);
            fetchSemana();
            fetchNotis();
        }
    };

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
            const headers = ['Fecha', 'Estado', 'Origen', 'Destino', 'Camión', 'Camionero', 'Tipo', 'Cliente', 'Toneladas', 'Precio/Tn', 'Importe', 'Factura', 'Estado factura', 'Fecha factura', 'Remitos'];
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
    const handleDownloadFactura = async (v) => {
        if (!v?.id || !v?.facturaUrl) return;
        try {
            await downloadFactura(v.id);
        } catch (e) {
            showToast(e?.response?.data?.error || 'No se pudo descargar la factura', 'error');
        }
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
        const d = new Date();
        const day = d.getDay(); // 0=Dom
        const diff = (day === 0 ? 6 : day - 1); // Lunes como inicio
        const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
        const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
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



    const viajesSemana = useMemo(() => viajes || [], [viajes]);
    const viajesFinalizados = useMemo(() => viajesSemana.filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajesSemana]);
    // Estadísticas para las cards
    const stats = useMemo(() => {
        // Viajes que deben tener factura: pendiente, en curso o finalizados
        const viajesRelevantes = viajesSemana.filter(v => {
            const estado = (v.estado || '').toLowerCase();
            return estado === 'pendiente' || estado === 'en curso' || estado === 'finalizado';
        });

        // Facturas SUBIDAS (con facturaUrl)
        const conFactura = viajesRelevantes.filter(v => !!v.facturaUrl).length;

        // Viajes SIN factura subida
        const sinFactura = viajesRelevantes.filter(v => !v.facturaUrl).length;

        // Viajes cobrados (estado === 'cobrada')
        const cobradas = viajesRelevantes.filter(v => {
            const estado = (v.facturaEstado || '').toLowerCase();
            return estado === 'cobrada' || estado === 'cobrado';
        }).length;

        // Pendientes de cobro (tienen datos de factura pero NO están cobradas)
        const pendientesCobro = viajesRelevantes.filter(v => {
            const estado = (v.facturaEstado || '').toLowerCase();
            // Contar si tiene algún dato de factura (estado, fecha, precio) y NO está cobrada
            const tieneDatosFactura = v.facturaEstado || v.fechaFactura || v.precioUnitarioFactura;
            return tieneDatosFactura && estado !== 'cobrada' && estado !== 'cobrado';
        }).length;

        // Viajes sin remitos (solo finalizados)
        const sinRemitos = viajesFinalizados.filter(v => !v.remitosJson || v.remitosJson === '[]').length;

        return { conFactura, sinFactura, cobradas, pendientesCobro, sinRemitos, totalRelevantes: viajesRelevantes.length };
    }, [viajesSemana, viajesFinalizados]);
    // Filtros avanzados
    const [fCliente, setFCliente] = useState('todos');
    const opcionesEstadoFactura = useMemo(() => {
        const set = new Set();
        (viajesSemana || []).forEach(v => set.add((v.facturaEstado || 'pendiente').toLowerCase()));
        return ['todos', ...Array.from(set)];
    }, [viajesSemana]);
    const opcionesCliente = useMemo(() => {
        const set = new Set();
        (viajesSemana || []).forEach(v => { if (v.cliente) set.add(v.cliente); });
        return ['todos', ...Array.from(set)];
    }, [viajesSemana]);

    const viajesFiltrados = useMemo(() => {
        const t = term.trim().toLowerCase();
        const list = (viajesSemana || []).filter(v => (
            `${v.origen || ''} ${v.destino || ''} ${v.tipoMercaderia || ''} ${v.cliente || ''} ${v.camion?.patente || v.camionId || ''} ${v.camionero?.nombre || v.camioneroNombre || ''}`
                .toLowerCase().includes(t)
        ));
        return list
            .filter(v => (fEstado === 'todos' ? true : (v.facturaEstado || 'pendiente').toLowerCase() === fEstado))
            .filter(v => (fCliente === 'todos' ? true : (v.cliente || '') === fCliente));
    }, [viajesSemana, term, fEstado, fCliente]);

    // Derivados (definidos después de viajesFiltrados)
    const curPage = page;
    const totalPages = Math.ceil(viajesFiltrados.length / pageSize);
    const viajesPagina = useMemo(() => {
        const start = (curPage - 1) * pageSize;
        return viajesFiltrados.slice(start, start + pageSize);
    }, [viajesFiltrados, curPage, pageSize]);

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
                    case 'o':
                        e.preventDefault();
                        if (selectedRowId) {
                            const v = viajesPagina.find(v => v.id === selectedRowId);
                            if (v) openObservaciones(v);
                        }
                        break;
                    case 'x':
                        e.preventDefault();
                        if (facturaModal.open) closeFactura();
                        if (remitosUploadModal.open) closeUploadRemitos();
                        if (creditNoteModal.open) closeCreditNote();
                        if (remitosModal.open) closeRemitos();
                        if (iaModal.open) closeIa();
                        if (observacionesModal.open) closeObservaciones();
                        if (editarImporteModal.open) closeEditarImporte();
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
    }, [viajesPagina, selectedRowId, facturaModal.open, remitosUploadModal.open, remitosModal.open, iaModal.open, creditNoteModal.open, observacionesModal.open, editarImporteModal.open]);


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
                        <input
                            type="date"
                            className="form-control"
                            value={weekStart}
                            onChange={e => {
                                const selectedDate = new Date(e.target.value);
                                const day = selectedDate.getDay(); // 0=Dom
                                const diff = (day === 0 ? 6 : day - 1); // Lunes como inicio
                                const monday = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - diff);
                                const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
                                setWeekStart(monday.toISOString().slice(0, 10));
                                setWeekEnd(sunday.toISOString().slice(0, 10));
                            }}
                        />
                    </div>
                    <div>
                        <label className="form-label mb-1">Semana (fin)</label>
                        <input
                            type="date"
                            className="form-control"
                            value={weekEnd}
                            onChange={e => {
                                const selectedDate = new Date(e.target.value);
                                const day = selectedDate.getDay(); // 0=Dom
                                const diff = (day === 0 ? 6 : day - 1); // Lunes como inicio
                                const monday = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - diff);
                                const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
                                setWeekStart(monday.toISOString().slice(0, 10));
                                setWeekEnd(sunday.toISOString().slice(0, 10));
                            }}
                        />
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
                    <button className="btn btn-primary btn-action" onClick={openFinanzas} title="Resumen financiero mensual">
                        <i className="bi bi-currency-dollar me-1"></i>
                        Finanzas
                    </button>
                    <button className="btn btn-success btn-action" onClick={() => openAdelantoModal(null, '')} title="Registrar adelanto">
                        <i className="bi bi-cash-coin me-1"></i>
                        Adelanto
                    </button>
                    <button className="btn btn-outline-success btn-action" onClick={openGestionAdelantos} title="Gestionar adelantos del mes">
                        <i className="bi bi-pencil-square me-1"></i>
                        Gestionar
                    </button>
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
                    <StatCard icon={<i className="bi bi-receipt"></i>} label="Facturas subidas" value={stats.conFactura} hint={`${stats.sinFactura} sin factura`} />
                </div>
                <div className="col-12 col-sm-6 col-lg-3">
                    <StatCard icon={<i className="bi bi-cash-coin"></i>} label="Cobradas" value={stats.cobradas} hint={`${stats.pendientesCobro} pendientes`} />
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
                                        <th scope="col">Toneladas</th>
                                        <th scope="col">Precio/Tn</th>
                                        <th scope="col">Importe</th>
                                        <th scope="col">Acoplado</th>
                                        <th scope="col">Subtotal</th>
                                        <th scope="col">Subtotal Negro</th>
                                        <th scope="col">Total a cobrar</th>
                                        <th scope="col">NC</th>
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
                                        const hasSubtotal = v.precioUnitarioFactura != null;
                                        const subtotalCalc = hasSubtotal ? (() => {
                                            const base = safeParseNumber(v.precioUnitarioFactura) * (1 + (safeParseNumber(v.ivaPercentaje) || 0) / 100);
                                            const total = base - safeParseNumber(v.notasCreditoTotal);
                                            return Number(total.toFixed(2));
                                        })() : null;
                                        const hasNegro = v.precioUnitarioNegro != null;
                                        const subtotalNegroCalc = hasNegro ? safeParseNumber(v.precioUnitarioNegro) : null;
                                        const totalCobrar = (hasSubtotal ? subtotalCalc : 0) + (hasNegro ? subtotalNegroCalc : 0);
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
                                                <td>
                                                    {hasSubtotal ? subtotalCalc : (v.precioUnitarioFactura ?? '-')}
                                                </td>
                                                <td>{hasNegro ? subtotalNegroCalc : '-'}</td>
                                                <td>{(hasSubtotal || hasNegro) ? Number(totalCobrar.toFixed(2)) : '-'}</td>
                                                <td>
                                                    {v.notasCreditoCantidad > 0 ? (
                                                        <span className="badge bg-danger-subtle text-danger" title={`Total NC: $${v.notasCreditoTotal}`}>
                                                            {v.notasCreditoCantidad}
                                                        </span>
                                                    ) : '-'}
                                                </td>
                                                <td>
                                                    {v.facturaUrl ? (
                                                        <button
                                                            type="button"
                                                            className="btn btn-link p-0"
                                                            onClick={() => handleDownloadFactura(v)}
                                                            aria-label={`Descargar factura del viaje ${v.id}`}
                                                        >
                                                            Ver
                                                        </button>
                                                    ) : '-'}
                                                </td>
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
                                                    {v.observaciones && (
                                                        <i className="bi bi-chat-left-text-fill text-primary me-2" title="Tiene observaciones" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); openObservaciones(v); }}></i>
                                                    )}
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
                                                                const approxW = 240; // ancho estimado del menú
                                                                const approxH = 180; // alto estimado del menú
                                                                const v = (window.innerHeight - rect.bottom >= approxH) ? 'down' : 'up';
                                                                const h = (window.innerWidth - rect.right >= approxW) ? 'right' : 'left';
                                                                setRowMenuPlacement({ v, h });
                                                                setRowMenuPos({ topDown: rect.bottom, topUp: rect.top, left: rect.left, right: window.innerWidth - rect.right });
                                                            }
                                                        }}
                                                    >
                                                        <i className="bi bi-three-dots"></i>

                                                    </button>
                                                    {rowActionsOpen === v.id && createPortal(
                                                        <div className="dropdown-menu show" style={{
                                                            position: 'fixed',
                                                            top: (rowMenuPlacement.v === 'down' ? rowMenuPos.topDown : rowMenuPos.topUp),
                                                            ...(rowMenuPlacement.h === 'right' ? { right: rowMenuPos.right } : { left: rowMenuPos.left }),
                                                            transform: `translate(${rowMenuPlacement.h === 'left' ? '-100%' : '0'}, ${rowMenuPlacement.v === 'up' ? '-100%' : '0'})`,
                                                            zIndex: 1055
                                                        }}>
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
                                                            <div className="dropdown-divider"></div>
                                                            <button className="dropdown-item" onClick={() => { openEditarImporte(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-currency-dollar me-2"></i> Editar importe
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => { openObservaciones(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-chat-left-text me-2"></i> Observaciones
                                                            </button>
                                                            <button className="dropdown-item" onClick={() => { openCreditNote(v); setRowActionsOpen(null); }}>
                                                                <i className="bi bi-receipt-cutoff me-2"></i> Nota de crédito
                                                            </button>
                                                        </div>, portalRef.current
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
                    <DashboardCharts viajes={viajesFinalizados} />
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
                                    <label className="form-label">IVA</label>
                                    <select className="form-select" value={facturaModal.ivaPercentaje} onChange={(e) => setFacturaModal(m => ({ ...m, ivaPercentaje: Number(e.target.value) }))}>
                                        <option value={0}>Sin IVA</option>
                                        <option value={10.5}>IVA 10.5%</option>
                                        <option value={21}>IVA 21%</option>
                                    </select>
                                </div>
                            </div>
                            {facturaModal.precioUnitario && !isNaN(Number(facturaModal.precioUnitario)) && Number(facturaModal.precioUnitario) > 0 && (
                                <div className="alert alert-info mb-3">
                                    <strong>Cálculo:</strong>
                                    <div className="row g-2 mt-2">
                                        <div className="col-6">
                                            <small>Precio: <strong>{Number(facturaModal.precioUnitario).toFixed(2)} $</strong></small>
                                        </div>
                                        <div className="col-6">
                                            <small>IVA ({Number(facturaModal.ivaPercentaje || 0)} %): <strong>{(Number(facturaModal.precioUnitario) * Number(facturaModal.ivaPercentaje || 0) / 100).toFixed(2)} $</strong></small>
                                        </div>
                                        <div className="col-12">
                                            <small className="text-primary"><strong>Total con IVA: $ {(Number(facturaModal.precioUnitario) * (1 + Number(facturaModal.ivaPercentaje || 0) / 100)).toFixed(2)}</strong></small>
                                        </div>
                                    </div>
                                </div>
                            )}
                            <div className="mb-3">
                                <label className="form-label">Precio Unitario en negro</label>
                                <input type="number" min={0} step={0.01} className="form-control" value={facturaModal.precioUnitarioNegro}
                                    onChange={(e) => setFacturaModal(m => ({ ...m, precioUnitarioNegro: e.target.value }))} />
                            </div>
                            <div className="mb-0">
                                <label className="form-label">Archivo (opcional)</label>
                                <input
                                    key={facturaModal.open ? 'file-input-open' : 'file-input-closed'}
                                    type="file"
                                    className="form-control"
                                    accept="image/*,.pdf"
                                    onChange={(e) => setFacturaModal(m => ({ ...m, file: e.target.files?.[0] || null }))}
                                />
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

            {/* Modal: Finalizar viaje (CEO/Admin) */}
            <div className={`modal ${finalizarModal.open ? 'd-block show' : 'fade'}`} tabIndex="-1" aria-hidden={!finalizarModal.open} style={finalizarModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Finalizar viaje #{finalizarModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeFinalizar}></button>
                        </div>
                        <div className="modal-body">
                            {finalizarModal.error && <div className="alert alert-danger">{finalizarModal.error}</div>}
                            <div className="mb-3">
                                <label className="form-label">Kilómetros</label>
                                <input type="number" className="form-control" min="0" value={finalizarModal.km} onChange={e => setFinalizarModal(m => ({ ...m, km: e.target.value }))} />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Combustible</label>
                                <input type="number" className="form-control" min="0" step="0.01" value={finalizarModal.combustible} onChange={e => setFinalizarModal(m => ({ ...m, combustible: e.target.value }))} />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Toneladas cargadas (opcional)</label>
                                <input type="number" className="form-control" min="0" step="0.01" value={finalizarModal.kilos} onChange={e => setFinalizarModal(m => ({ ...m, kilos: e.target.value }))} />
                                <div className="form-text">Si hay precio/tonelada, se recalcula el importe automáticamente.</div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeFinalizar} disabled={finalizarModal.loading}>Cancelar</button>
                            <button type="button" className="btn btn-success" onClick={submitFinalizar} disabled={finalizarModal.loading}>
                                {finalizarModal.loading ? <span className="spinner-border spinner-border-sm" role="status" /> : 'Finalizar viaje'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Resumen Financiero Mensual */}
            <div
                className={`modal ${finanzasModal.open ? 'd-block show' : 'fade'}`}
                tabIndex="-1"
                aria-hidden={!finanzasModal.open}
                style={finanzasModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1050 } : {}}
                onClick={(e) => {
                    // Cerrar solo si se hace clic en el backdrop y no hay modal secundario abierto
                    if (e.target === e.currentTarget && !detalleClienteModal.open) {
                        closeFinanzas();
                    }
                }}
            >
                <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => e.stopPropagation()}>
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">
                                <i className="bi bi-currency-dollar me-2"></i>
                                Resumen Financiero Mensual
                            </h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={(e) => { e.stopPropagation(); closeFinanzas(); }}></button>
                        </div>
                        <div className="modal-body">
                            {errorFinanzas && <div className="alert alert-danger">{errorFinanzas}</div>}
                            {loadingFinanzas && (
                                <div className="alert alert-info d-flex align-items-center gap-2">
                                    <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                    Cargando viajes del mes...
                                </div>
                            )}
                            {/* Filtros */}
                            <div className="row g-3 mb-4">
                                <div className="col-md-6">
                                    <label className="form-label">Mes</label>
                                    <input
                                        type="month"
                                        className="form-control"
                                        value={finanzasModal.mes}
                                        onChange={e => setFinanzasModal(m => ({ ...m, mes: e.target.value }))}
                                    />
                                </div>
                                <div className="col-md-6">
                                    <label className="form-label">Cliente</label>
                                    <select
                                        className="form-select"
                                        value={finanzasModal.clienteFiltro}
                                        onChange={e => setFinanzasModal(m => ({ ...m, clienteFiltro: e.target.value }))}
                                    >
                                        <option value="todos">Todos los clientes</option>
                                        {opcionesCliente.filter(c => c !== 'todos').map(cliente => (
                                            <option key={cliente} value={cliente}>{cliente}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Resumen General */}
                            <div className="row g-3 mb-4">
                                <div className="col-md-4">
                                    <div className="card bg-success bg-opacity-10 border-success">
                                        <div className="card-body">
                                            <h6 className="card-subtitle mb-2 text-success">
                                                <i className="bi bi-check-circle me-1"></i>
                                                Cobrado
                                            </h6>
                                            <h3 className="card-title mb-0 text-success">
                                                ${formatearMoneda(datosFinanzas.totalFacturado)}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="card bg-warning bg-opacity-10 border-warning">
                                        <div className="card-body">
                                            <h6 className="card-subtitle mb-2 text-warning">
                                                <i className="bi bi-clock-history me-1"></i>
                                                Pendiente
                                            </h6>
                                            <h3 className="card-title mb-0 text-warning">
                                                ${formatearMoneda(datosFinanzas.totalPendiente)}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-md-4">
                                    <div className="card bg-primary bg-opacity-10 border-primary">
                                        <div className="card-body">
                                            <h6 className="card-subtitle mb-2 text-primary">
                                                <i className="bi bi-calculator me-1"></i>
                                                Total
                                            </h6>
                                            <h3 className="card-title mb-0 text-primary">
                                                ${formatearMoneda(datosFinanzas.totalFacturado + datosFinanzas.totalPendiente)}
                                            </h3>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Detalle por Cliente */}
                            {finanzasModal.clienteFiltro === 'todos' && Object.keys(datosFinanzas.porCliente).length > 0 && (
                                <div>
                                    <h5 className="mb-3">
                                        <i className="bi bi-people me-2"></i>
                                        Detalle por Cliente
                                    </h5>
                                    <div className="table-responsive">
                                        <table className="table table-sm table-hover">
                                            <thead>
                                                <tr>
                                                    <th>Cliente</th>
                                                    <th className="text-end">Cobrado</th>
                                                    <th className="text-end">Pendiente</th>
                                                    <th className="text-end">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(datosFinanzas.porCliente).sort(([a], [b]) => a.localeCompare(b)).map(([cliente, datos]) => (
                                                    <tr key={cliente} style={{ cursor: 'pointer' }} onClick={() => openDetalleCliente(cliente)}>
                                                        <td>{cliente}</td>
                                                        <td className="text-end text-success">
                                                            ${formatearMoneda(datos.cobrado)}
                                                        </td>
                                                        <td className="text-end text-warning">
                                                            ${formatearMoneda(datos.pendiente)}
                                                        </td>
                                                        <td className="text-end fw-bold">
                                                            ${formatearMoneda(datos.cobrado + datos.pendiente)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Información adicional */}
                            <div className="mt-3 text-muted small">
                                <i className="bi bi-info-circle me-1"></i>
                                {datosFinanzas.viajesMes} viaje(s) finalizado(s) en el período seleccionado
                                {finanzasModal.clienteFiltro !== 'todos' && ` para ${finanzasModal.clienteFiltro}`}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={(e) => { e.stopPropagation(); closeFinanzas(); }}>Cerrar</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Detalle de Viajes por Cliente */}
            {detalleClienteModal.open && (
                <div
                    className="modal d-block show"
                    tabIndex="-1"
                    style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                        e.stopPropagation();
                        e.nativeEvent.stopImmediatePropagation();
                        // Cerrar solo si se hace clic en el backdrop (no en el contenido del modal)
                        if (e.target === e.currentTarget) {
                            closeDetalleCliente(e);
                        }
                    }}
                >
                    <div className="modal-dialog modal-lg modal-dialog-scrollable" onClick={(e) => { e.stopPropagation(); e.nativeEvent.stopImmediatePropagation(); }}>
                        <div className="modal-content">
                            <div className="modal-header">
                                <h1 className="modal-title fs-5">
                                    <i className="bi bi-truck me-2"></i>
                                    Viajes de {detalleClienteModal.cliente}
                                </h1>
                                <button type="button" className="btn-close" aria-label="Close" onClick={(e) => closeDetalleCliente(e)}></button>
                            </div>
                            <div className="modal-body">
                                {detalleClienteModal.viajes.length === 0 ? (
                                    <div className="alert alert-info">No hay viajes para mostrar</div>
                                ) : (
                                    <div className="table-responsive">
                                        <table className="table table-sm table-hover">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Origen - Destino</th>
                                                    <th className="text-end">Total a cobrar</th>
                                                    <th>Estado</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detalleClienteModal.viajes.map(v => {
                                                    const subtotal = v.precioUnitarioFactura
                                                        ? safeParseNumber(v.precioUnitarioFactura) * (1 + (safeParseNumber(v.ivaPercentaje) || 0) / 100) - safeParseNumber(v.notasCreditoTotal)
                                                        : 0;
                                                    const subtotalNegro = safeParseNumber(v.precioUnitarioNegro);
                                                    const totalCobrar = subtotal + subtotalNegro;
                                                    // Formatear fecha sin conversión de zona horaria
                                                    const fechaFormateada = v.fecha
                                                        ? (() => {
                                                            const [year, month, day] = v.fecha.split('-');
                                                            return `${day}/${month}/${year}`;
                                                        })()
                                                        : '-';
                                                    const estadoFactura = v.facturaEstado || 'pendiente';

                                                    return (
                                                        <tr key={v.id}>
                                                            <td>{fechaFormateada}</td>
                                                            <td>{v.origen} - {v.destino}</td>
                                                            <td className="text-end fw-bold">
                                                                ${formatearMoneda(totalCobrar)}
                                                            </td>
                                                            <td>
                                                                <span className={`badge ${estadoFactura.toLowerCase() === 'cobrada' ? 'bg-success' :
                                                                    estadoFactura.toLowerCase() === 'emitida' ? 'bg-info' :
                                                                        estadoFactura.toLowerCase() === 'vencida' ? 'bg-danger' :
                                                                            'bg-warning'
                                                                    }`}>
                                                                    {estadoFactura}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            <tfoot>
                                                <tr className="table-primary fw-bold">
                                                    <td colSpan="2" className="text-end">Total:</td>
                                                    <td className="text-end">
                                                        ${formatearMoneda(detalleClienteModal.viajes.reduce((sum, v) => {
                                                            const subtotal = v.precioUnitarioFactura
                                                                ? Number(v.precioUnitarioFactura) * (1 + (v.ivaPercentaje || 0) / 100) - (v.notasCreditoTotal || 0)
                                                                : 0;
                                                            const subtotalNegro = Number(v.precioUnitarioNegro) || 0;
                                                            return sum + subtotal + subtotalNegro;
                                                        }, 0))}
                                                    </td>
                                                    <td></td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={(e) => closeDetalleCliente(e)}>Cerrar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Nota de crédito */}
            <div className={`modal ${creditNoteModal.open ? 'd-block show' : 'fade'}`} id="modalNotaCredito" tabIndex="-1" aria-hidden={!creditNoteModal.open} style={creditNoteModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-6">Nota de crédito - Viaje #{creditNoteModal.id ?? ''}</h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeCreditNote}></button>
                        </div>
                        <div className="modal-body">
                            {creditNoteModal.error && <div className="alert alert-danger">{creditNoteModal.error}</div>}
                            <div className="mb-3">
                                <label className="form-label">Motivo *</label>
                                <select className="form-select" value={creditNoteModal.motivo} onChange={(e) => setCreditNoteModal(m => ({ ...m, motivo: e.target.value }))}>
                                    <option value="">-- Selecciona motivo --</option>
                                    <option value="devolucion">Devolución de pago</option>
                                    <option value="ajuste">Ajuste de tarifa</option>
                                    <option value="error">Error en factura</option>
                                    <option value="descuento">Descuento especial</option>
                                    <option value="otro">Otro</option>
                                </select>
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Monto *</label>
                                <input type="number" min={0} step={0.01} className="form-control" placeholder="Ej: 100.50" value={creditNoteModal.monto} onChange={(e) => setCreditNoteModal(m => ({ ...m, monto: e.target.value }))} />
                            </div>
                            <div className="mb-3">
                                <label className="form-label">Descripción</label>
                                <textarea className="form-control" rows="3" placeholder="Detalles adicionales..." value={creditNoteModal.descripcion} onChange={(e) => setCreditNoteModal(m => ({ ...m, descripcion: e.target.value }))}></textarea>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeCreditNote}>Cancelar</button>
                            <button type="button" className="btn btn-primary" onClick={submitCreditNote} disabled={creditNoteModal.loading}>
                                {creditNoteModal.loading ? <span><span className="spinner-border spinner-border-sm me-2" role="status"></span>Procesando...</span> : 'Crear nota de crédito'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Observaciones */}
            <div className={`modal ${observacionesModal.open ? 'd-block show' : 'fade'}`} tabIndex="-1" aria-hidden={!observacionesModal.open} style={observacionesModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header bg-light">
                            <h1 className="modal-title fs-5">
                                <i className="bi bi-chat-left-text me-2"></i>
                                Observaciones del viaje #{observacionesModal.id}
                            </h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeObservaciones}></button>
                        </div>
                        <div className="modal-body">
                            {observacionesModal.error && <div className="alert alert-danger">{observacionesModal.error}</div>}
                            <div className="mb-0">
                                <label className="form-label">Notas y comentarios</label>
                                <textarea
                                    className="form-control"
                                    rows="6"
                                    placeholder="Agregá observaciones, notas internas o cualquier detalle relevante del viaje..."
                                    value={observacionesModal.texto}
                                    onChange={(e) => setObservacionesModal(m => ({ ...m, texto: e.target.value }))}
                                    disabled={observacionesModal.loading}
                                ></textarea>
                                <div className="form-text">
                                    <i className="bi bi-info-circle me-1"></i>
                                    Estas observaciones son privadas y solo visibles para CEO y Administración.
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeObservaciones} disabled={observacionesModal.loading}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn-primary" onClick={submitObservaciones} disabled={observacionesModal.loading}>
                                {observacionesModal.loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-lg me-1"></i>
                                        Guardar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Editar Importe */}
            <div className={`modal ${editarImporteModal.open ? 'd-block show' : 'fade'}`} tabIndex="-1" aria-hidden={!editarImporteModal.open} style={editarImporteModal.open ? { backgroundColor: 'rgba(0,0,0,0.5)' } : {}}>
                <div className="modal-dialog modal-dialog-centered">
                    <div className="modal-content">
                        <div className="modal-header bg-light">
                            <h1 className="modal-title fs-5">
                                <i className="bi bi-currency-dollar me-2"></i>
                                Editar importe del viaje #{editarImporteModal.id}
                            </h1>
                            <button type="button" className="btn-close" aria-label="Close" onClick={closeEditarImporte}></button>
                        </div>
                        <div className="modal-body">
                            {editarImporteModal.error && <div className="alert alert-danger">{editarImporteModal.error}</div>}
                            {editarImporteModal.viaje && (
                                <div className="mb-3">
                                    <div className="small text-muted">
                                        <div><strong>Viaje:</strong> {editarImporteModal.viaje.origen} → {editarImporteModal.viaje.destino}</div>
                                        <div><strong>Importe actual:</strong> ${editarImporteModal.viaje.importe || 0}</div>
                                    </div>
                                </div>
                            )}
                            <div className="mb-0">
                                <label className="form-label">Nuevo importe *</label>
                                <input
                                    type="number"
                                    className="form-control"
                                    min={0}
                                    step={0.01}
                                    placeholder="Ingresá el nuevo importe"
                                    value={editarImporteModal.nuevoImporte}
                                    onChange={(e) => setEditarImporteModal(m => ({ ...m, nuevoImporte: e.target.value }))}
                                    disabled={editarImporteModal.loading}
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" onClick={closeEditarImporte} disabled={editarImporteModal.loading}>
                                Cancelar
                            </button>
                            <button type="button" className="btn btn-primary" onClick={submitEditarImporte} disabled={editarImporteModal.loading || !editarImporteModal.nuevoImporte}>
                                {editarImporteModal.loading ? (
                                    <>
                                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                        Guardando...
                                    </>
                                ) : (
                                    <>
                                        <i className="bi bi-check-lg me-1"></i>
                                        Guardar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal: Registrar Adelanto */}
            <div className={`modal fade ${adelantoModal.open ? 'show' : ''}`} style={{ display: adelantoModal.open ? 'block' : 'none' }} tabIndex="-1">
                <div className="modal-dialog modal-dialog-centered modal-lg">
                    <div className="modal-content border-0 shadow-lg">
                        <div className="modal-header border-0 py-4" style={{ background: 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' }}>
                            <div className="w-100">
                                <h5 className="text-white mb-1" style={{ fontSize: '1.3rem', fontWeight: '600' }}>
                                    <i className="bi bi-cash-coin me-2"></i>
                                    Registrar Adelanto
                                </h5>
                                <small className="text-white" style={{ opacity: 0.95, fontSize: '0.85rem' }}>Registra un adelanto para un camionero</small>
                            </div>
                            <button type="button" className="btn-close btn-close-white ms-3" onClick={closeAdelantoModal}></button>
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
                                        onChange={e => setAdelantoModal(m => ({ ...m, camioneroId: e.target.value }))}
                                        disabled={adelantoModal.loading}
                                    >
                                        <option value="">Seleccioná un camionero...</option>
                                        {camioneros.map(c => (
                                            <option key={c.id} value={c.id}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-12">
                                    <label className="form-label">
                                        <strong>Monto del adelanto</strong>
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
                                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(mes => {
                                            const date = new Date(adelantoModal.anio, mes - 1, 1);
                                            const label = date.toLocaleString('es-AR', { month: 'long' });
                                            return <option key={mes} value={String(mes).padStart(2, '0')}>{label}</option>;
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

            {/* Modal: Gestionar Adelantos */}
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
                                                                ${formatearMoneda(parseFloat(a.monto))}
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
        </>
    );
}

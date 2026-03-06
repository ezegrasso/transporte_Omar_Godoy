import { useEffect, useMemo, useState } from 'react';
import api from '../../services/api';

const fmtLitros = (value) => Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtMoney = (value) => Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (value) => {
    if (!value) return '-';
    try {
        const [y, m, d] = String(value).split('-').map(Number);
        return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString('es-AR');
    } catch {
        return value;
    }
};

const hoyISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ingresoFormVacio = () => ({
    fechaIngreso: hoyISO(),
    litros: '',
    precioUnitario: '',
    proveedor: '',
    observaciones: '',
    tipo: 'ingreso',
});

export default function CeoCombustiblePanel({ showToast }) {
    const detalleModalVacio = { open: false, loading: false, camion: null, cargas: [], totalLitros: 0, totalImporte: 0, precioUnitarioPredio: 0 };
    const edicionVacia = { id: null, fechaCarga: '', camionId: '', origen: 'externo', litros: '', precioUnitario: '', observaciones: '' };

    const [mes, setMes] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [loading, setLoading] = useState(false);
    const [guardandoPrecioPredio, setGuardandoPrecioPredio] = useState(false);
    const [precioUnitarioPredio, setPrecioUnitarioPredio] = useState('');
    const [resumen, setResumen] = useState({
        stockPredio: 0,
        precioUnitarioPredio: 0,
        totalLitros: 0,
        totalPredio: 0,
        totalExterno: 0,
        detallePorCamion: []
    });

    const [ingresoForm, setIngresoForm] = useState(ingresoFormVacio());
    const [guardandoIngreso, setGuardandoIngreso] = useState(false);

    const [historialIngresos, setHistorialIngresos] = useState([]);
    const [loadingHistorial, setLoadingHistorial] = useState(false);
    const [mostrarHistorial, setMostrarHistorial] = useState(false);

    const [detalleModal, setDetalleModal] = useState(detalleModalVacio);
    const [camionesCombustible, setCamionesCombustible] = useState([]);
    const [editandoCarga, setEditandoCarga] = useState(false);
    const [edicionCarga, setEdicionCarga] = useState(edicionVacia);

    const paramsMes = useMemo(() => {
        const [anio, mesNum] = mes.split('-').map(Number);
        return { anio, mes: mesNum };
    }, [mes]);

    const fetchResumen = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/combustible/resumen?mes=${paramsMes.mes}&anio=${paramsMes.anio}`);
            setResumen({
                stockPredio: Number(data?.stockPredio || 0),
                precioUnitarioPredio: Number(data?.precioUnitarioPredio || 0),
                totalLitros: Number(data?.totalLitros || 0),
                totalPredio: Number(data?.totalPredio || 0),
                totalExterno: Number(data?.totalExterno || 0),
                detallePorCamion: Array.isArray(data?.detallePorCamion) ? data.detallePorCamion : []
            });
            setPrecioUnitarioPredio(String(Number(data?.precioUnitarioPredio || 0)));
        } catch (e) {
            showToast?.(e?.response?.data?.error || 'Error cargando resumen de combustible', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchHistorialIngresos = async () => {
        try {
            setLoadingHistorial(true);
            const { data } = await api.get('/combustible/predio/ingresos?limit=50');
            setHistorialIngresos(Array.isArray(data?.ingresos) ? data.ingresos : []);
        } catch (e) {
            showToast?.(e?.response?.data?.error || 'Error cargando historial de ingresos', 'error');
        } finally {
            setLoadingHistorial(false);
        }
    };

    const fetchCamionesCombustible = async () => {
        try {
            const todos = [];
            let page = 1;
            const limit = 100;
            let total = 0;

            do {
                const { data } = await api.get(`/camiones?page=${page}&limit=${limit}&sortBy=patente&order=ASC`);
                const rows = Array.isArray(data?.data) ? data.data : [];
                total = Number(data?.total || rows.length);
                todos.push(...rows);
                page += 1;
                if (rows.length === 0) break;
            } while (todos.length < total);

            setCamionesCombustible(todos);
        } catch {
            setCamionesCombustible([]);
        }
    };

    const guardarPrecioUnitarioPredio = async () => {
        try {
            setGuardandoPrecioPredio(true);
            await api.post('/combustible/predio/precio-unitario', {
                precioUnitarioPredio: Number(precioUnitarioPredio || 0)
            });
            showToast?.('Precio unitario de predio actualizado', 'success');
            await fetchResumen();
        } catch (e) {
            showToast?.(e?.response?.data?.error || 'Error actualizando precio unitario de predio', 'error');
        } finally {
            setGuardandoPrecioPredio(false);
        }
    };

    const handleAjuste = async (e) => {
        e.preventDefault();
        if (!ingresoForm.litros) {
            showToast?.('Ingresá los litros', 'warning');
            return;
        }
        if (!ingresoForm.fechaIngreso) {
            showToast?.('Ingresá la fecha', 'warning');
            return;
        }
        try {
            setGuardandoIngreso(true);
            const payload = {
                litros: Number(ingresoForm.litros),
                tipo: ingresoForm.tipo,
                fechaIngreso: ingresoForm.fechaIngreso,
                precioUnitario: ingresoForm.precioUnitario ? Number(ingresoForm.precioUnitario) : undefined,
                proveedor: ingresoForm.proveedor || '',
                observaciones: ingresoForm.observaciones || ''
            };
            const { data } = await api.post('/combustible/predio/ajuste', payload);
            const tipoLabel = ingresoForm.tipo === 'ingreso' ? 'Ingreso de combustible registrado' : 'Egreso / corrección registrada';
            showToast?.(tipoLabel, 'success');
            // Si el backend actualizó el precio de predio, sincronizar
            if (data?.precioUnitarioPredio != null) {
                setPrecioUnitarioPredio(String(Number(data.precioUnitarioPredio)));
            }
            setIngresoForm(ingresoFormVacio());
            await Promise.all([fetchResumen(), fetchHistorialIngresos()]);
        } catch (e) {
            showToast?.(e?.response?.data?.error || 'Error registrando movimiento de stock', 'error');
        } finally {
            setGuardandoIngreso(false);
        }
    };

    const openDetalleCamion = async (row) => {
        setEdicionCarga(edicionVacia);
        setDetalleModal({ open: true, loading: true, camion: row?.camion || null, cargas: [], totalLitros: 0, totalImporte: 0, precioUnitarioPredio: 0 });
        try {
            const { data } = await api.get(`/combustible/camion/${row.camionId}/detalle?mes=${paramsMes.mes}&anio=${paramsMes.anio}`);
            setDetalleModal({
                open: true,
                loading: false,
                camion: data?.camion || row?.camion || null,
                cargas: Array.isArray(data?.cargas) ? data.cargas : [],
                totalLitros: Number(data?.totalLitros || 0),
                totalImporte: Number(data?.totalImporte || 0),
                precioUnitarioPredio: Number(data?.precioUnitarioPredio || 0)
            });
        } catch (e) {
            setDetalleModal({ open: true, loading: false, camion: row?.camion || null, cargas: [], totalLitros: 0, totalImporte: 0, precioUnitarioPredio: 0 });
            showToast?.(e?.response?.data?.error || 'No se pudo cargar el detalle del camión', 'error');
        }
    };

    const abrirEdicionCarga = (carga) => {
        setEdicionCarga({
            id: carga?.id || null,
            fechaCarga: String(carga?.fechaCarga || '').slice(0, 10),
            camionId: String(carga?.camionId || ''),
            origen: carga?.origen === 'predio' ? 'predio' : 'externo',
            litros: String(Number(carga?.litros || 0)),
            precioUnitario: String(Number(carga?.precioUnitarioAplicado ?? carga?.precioUnitario ?? 0)),
            observaciones: carga?.observaciones || ''
        });
    };

    const refrescarDetalleActual = async () => {
        if (!detalleModal?.camion?.id) return;
        const { data } = await api.get(`/combustible/camion/${detalleModal.camion.id}/detalle?mes=${paramsMes.mes}&anio=${paramsMes.anio}`);
        setDetalleModal((prev) => ({
            ...prev,
            camion: data?.camion || prev?.camion || null,
            cargas: Array.isArray(data?.cargas) ? data.cargas : [],
            totalLitros: Number(data?.totalLitros || 0),
            totalImporte: Number(data?.totalImporte || 0),
            precioUnitarioPredio: Number(data?.precioUnitarioPredio || 0)
        }));
    };

    const guardarEdicionCarga = async () => {
        if (!edicionCarga.id) return;
        if (!edicionCarga.fechaCarga || !edicionCarga.camionId || !edicionCarga.litros || !edicionCarga.precioUnitario) {
            showToast?.('Completá fecha, camión, litros y precio unitario', 'warning');
            return;
        }

        try {
            setEditandoCarga(true);
            await api.put(`/combustible/cargas/${edicionCarga.id}`, {
                fechaCarga: edicionCarga.fechaCarga,
                camionId: Number(edicionCarga.camionId),
                origen: edicionCarga.origen,
                litros: Number(edicionCarga.litros),
                precioUnitario: Number(edicionCarga.precioUnitario),
                observaciones: edicionCarga.observaciones || ''
            });

            showToast?.('Carga de combustible actualizada', 'success');
            setEdicionCarga(edicionVacia);
            await Promise.all([fetchResumen(), refrescarDetalleActual()]);
        } catch (e) {
            showToast?.(e?.response?.data?.error || 'Error actualizando carga de combustible', 'error');
        } finally {
            setEditandoCarga(false);
        }
    };

    useEffect(() => {
        fetchResumen();
    }, [mes]);

    useEffect(() => {
        fetchCamionesCombustible();
        fetchHistorialIngresos();
    }, []);

    return (
        <div className="card shadow-sm mt-3 border-primary-subtle">
            <div className="card-body">
                <div className="d-flex flex-wrap align-items-end gap-2 mb-3">
                    <h3 className="h5 mb-0 me-auto d-flex align-items-center gap-2">
                        <i className="bi bi-fuel-pump text-primary"></i>
                        Combustible
                    </h3>
                    <div>
                        <label className="form-label mb-1">Precio unitario predio</label>
                        <div className="d-flex gap-1">
                            <input
                                type="number"
                                min={0}
                                step={0.01}
                                className="form-control form-control-sm"
                                value={precioUnitarioPredio}
                                onChange={(e) => setPrecioUnitarioPredio(e.target.value)}
                                placeholder="Ej: 1200"
                            />
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={guardarPrecioUnitarioPredio}
                                disabled={guardandoPrecioPredio}
                            >
                                {guardandoPrecioPredio ? 'Guardando…' : 'Guardar'}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label className="form-label mb-1">Mes</label>
                        <input
                            type="month"
                            className="form-control form-control-sm"
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                        />
                    </div>
                </div>

                <div className="row g-3 mb-3">
                    <div className="col-12 col-md-4">
                        <div className="p-3 rounded border border-success-subtle bg-success bg-opacity-10 h-100">
                            <div className="small text-success-emphasis fw-semibold">Stock disponible en predio</div>
                            <div className="fs-3 fw-bold text-success">{fmtLitros(resumen.stockPredio)} L</div>
                        </div>
                    </div>
                    <div className="col-12 col-md-4">
                        <div className="p-3 rounded border border-primary-subtle bg-primary bg-opacity-10 h-100">
                            <div className="small text-primary-emphasis fw-semibold">Cargado desde predio (mes)</div>
                            <div className="fs-3 fw-bold text-primary">{fmtLitros(resumen.totalPredio)} L</div>
                        </div>
                    </div>
                    <div className="col-12 col-md-4">
                        <div className="p-3 rounded border border-secondary-subtle bg-secondary bg-opacity-10 h-100">
                            <div className="small text-secondary-emphasis fw-semibold">Cargado externo (mes)</div>
                            <div className="fs-3 fw-bold text-secondary">{fmtLitros(resumen.totalExterno)} L</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleAjuste} className="mb-4">
                    <div className="border rounded-3 overflow-hidden">
                        {/* Header del formulario */}
                        <div className="px-3 py-2 d-flex align-items-center justify-content-between"
                            style={{ background: 'linear-gradient(135deg, #0d6efd15 0%, #0d6efd08 100%)', borderBottom: '1px solid #dee2e6' }}>
                            <div className="d-flex align-items-center gap-2">
                                <i className="bi bi-fuel-pump-fill text-primary"></i>
                                <span className="fw-semibold text-primary-emphasis">
                                    {ingresoForm.tipo === 'ingreso' ? 'Registrar ingreso de combustible al predio' : 'Registrar egreso / corrección de stock'}
                                </span>
                            </div>
                            <div className="d-flex gap-1">
                                <button
                                    type="button"
                                    className={`btn btn-sm ${ingresoForm.tipo === 'ingreso' ? 'btn-primary' : 'btn-outline-primary'}`}
                                    onClick={() => setIngresoForm((p) => ({ ...p, tipo: 'ingreso' }))}
                                >
                                    <i className="bi bi-plus-circle me-1"></i>Ingreso
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${ingresoForm.tipo === 'egreso' ? 'btn-warning' : 'btn-outline-warning'}`}
                                    onClick={() => setIngresoForm((p) => ({ ...p, tipo: 'egreso' }))}
                                >
                                    <i className="bi bi-dash-circle me-1"></i>Egreso / corrección
                                </button>
                            </div>
                        </div>

                        {/* Campos del formulario */}
                        <div className="p-3">
                            <div className="row g-3">
                                {/* Fecha */}
                                <div className="col-12 col-sm-6 col-md-3">
                                    <label className="form-label fw-medium mb-1">
                                        <i className="bi bi-calendar3 me-1 text-primary opacity-75"></i>
                                        Fecha de entrega
                                    </label>
                                    <input
                                        type="date"
                                        className="form-control"
                                        value={ingresoForm.fechaIngreso}
                                        onChange={(e) => setIngresoForm((p) => ({ ...p, fechaIngreso: e.target.value }))}
                                        required
                                    />
                                </div>

                                {/* Litros */}
                                <div className="col-12 col-sm-6 col-md-2">
                                    <label className="form-label fw-medium mb-1">
                                        <i className="bi bi-droplet-fill me-1 text-info opacity-75"></i>
                                        Litros
                                    </label>
                                    <div className="input-group">
                                        <input
                                            type="number"
                                            className="form-control"
                                            min={0.01}
                                            step={0.01}
                                            value={ingresoForm.litros}
                                            onChange={(e) => setIngresoForm((p) => ({ ...p, litros: e.target.value }))}
                                            placeholder="0.00"
                                            required
                                        />
                                        <span className="input-group-text text-body-secondary">L</span>
                                    </div>
                                </div>

                                {/* Precio por litro */}
                                {ingresoForm.tipo === 'ingreso' && (
                                    <div className="col-12 col-sm-6 col-md-2">
                                        <label className="form-label fw-medium mb-1">
                                            <i className="bi bi-currency-dollar me-1 text-success opacity-75"></i>
                                            Precio / litro
                                        </label>
                                        <div className="input-group">
                                            <span className="input-group-text text-body-secondary">$</span>
                                            <input
                                                type="number"
                                                className="form-control"
                                                min={0}
                                                step={0.01}
                                                value={ingresoForm.precioUnitario}
                                                onChange={(e) => setIngresoForm((p) => ({ ...p, precioUnitario: e.target.value }))}
                                                placeholder="0.00"
                                            />
                                        </div>
                                        {ingresoForm.litros && ingresoForm.precioUnitario && (
                                            <div className="form-text text-success fw-semibold">
                                                Total: ${fmtMoney(Number(ingresoForm.litros) * Number(ingresoForm.precioUnitario))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Proveedor */}
                                {ingresoForm.tipo === 'ingreso' && (
                                    <div className="col-12 col-sm-6 col-md-3">
                                        <label className="form-label fw-medium mb-1">
                                            <i className="bi bi-truck me-1 text-secondary opacity-75"></i>
                                            Proveedor / procedencia
                                        </label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={ingresoForm.proveedor}
                                            onChange={(e) => setIngresoForm((p) => ({ ...p, proveedor: e.target.value }))}
                                            placeholder="Ej: YPF, Refinor, ..."
                                            maxLength={120}
                                        />
                                    </div>
                                )}

                                {/* Observaciones */}
                                <div className="col-12 col-md-4">
                                    <label className="form-label fw-medium mb-1">
                                        <i className="bi bi-chat-text me-1 text-secondary opacity-75"></i>
                                        Observaciones
                                    </label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        value={ingresoForm.observaciones}
                                        onChange={(e) => setIngresoForm((p) => ({ ...p, observaciones: e.target.value }))}
                                        placeholder="Notas adicionales…"
                                        maxLength={300}
                                    />
                                </div>
                            </div>

                            {/* Preview y botón */}
                            <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-3 pt-3 border-top">
                                {ingresoForm.tipo === 'ingreso' && ingresoForm.litros ? (
                                    <div className="d-flex gap-3 flex-wrap">
                                        <div className="text-body-secondary small">
                                            <i className="bi bi-arrow-up-circle-fill text-success me-1"></i>
                                            Nuevo stock estimado:{' '}
                                            <strong className="text-success">
                                                {fmtLitros(resumen.stockPredio + Number(ingresoForm.litros || 0))} L
                                            </strong>
                                        </div>
                                        {ingresoForm.precioUnitario && (
                                            <div className="text-body-secondary small">
                                                <i className="bi bi-receipt me-1 text-primary"></i>
                                                Importe total:{' '}
                                                <strong className="text-primary">
                                                    ${fmtMoney(Number(ingresoForm.litros) * Number(ingresoForm.precioUnitario))}
                                                </strong>
                                            </div>
                                        )}
                                    </div>
                                ) : ingresoForm.tipo === 'egreso' && ingresoForm.litros ? (
                                    <div className="text-body-secondary small">
                                        <i className="bi bi-arrow-down-circle-fill text-warning me-1"></i>
                                        Nuevo stock estimado:{' '}
                                        <strong className={resumen.stockPredio - Number(ingresoForm.litros || 0) < 0 ? 'text-danger' : 'text-warning'}>
                                            {fmtLitros(resumen.stockPredio - Number(ingresoForm.litros || 0))} L
                                        </strong>
                                    </div>
                                ) : <span />}

                                <button
                                    type="submit"
                                    className={`btn ${ingresoForm.tipo === 'ingreso' ? 'btn-primary' : 'btn-warning'} px-4`}
                                    disabled={guardandoIngreso}
                                >
                                    {guardandoIngreso ? (
                                        <><span className="spinner-border spinner-border-sm me-2" role="status" />Guardando…</>
                                    ) : ingresoForm.tipo === 'ingreso' ? (
                                        <><i className="bi bi-check-circle me-2"></i>Registrar ingreso</>
                                    ) : (
                                        <><i className="bi bi-check-circle me-2"></i>Registrar egreso</>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                {/* Historial de ingresos / movimientos de predio */}
                <div className="mb-4">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
                        onClick={() => {
                            setMostrarHistorial((v) => !v);
                            if (!mostrarHistorial && historialIngresos.length === 0) fetchHistorialIngresos();
                        }}
                    >
                        <i className={`bi bi-chevron-${mostrarHistorial ? 'up' : 'down'}`}></i>
                        Historial de movimientos de stock de predio
                        {historialIngresos.length > 0 && (
                            <span className="badge text-bg-secondary">{historialIngresos.length}</span>
                        )}
                    </button>

                    {mostrarHistorial && (
                        <div className="border rounded-3 mt-2 overflow-hidden">
                            <div className="px-3 py-2 d-flex align-items-center justify-content-between"
                                style={{ background: '#f8f9fa', borderBottom: '1px solid #dee2e6' }}>
                                <span className="fw-semibold text-body-secondary small">
                                    <i className="bi bi-clock-history me-1"></i>
                                    Últimos movimientos registrados
                                </span>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-secondary"
                                    onClick={fetchHistorialIngresos}
                                    disabled={loadingHistorial}
                                >
                                    <i className="bi bi-arrow-clockwise"></i>
                                </button>
                            </div>
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle mb-0">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Fecha</th>
                                            <th>Tipo</th>
                                            <th>Procedencia / proveedor</th>
                                            <th className="text-end">Litros</th>
                                            <th className="text-end">Precio / L</th>
                                            <th className="text-end">Total</th>
                                            <th>Observaciones</th>
                                            <th>Registrado por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {loadingHistorial ? (
                                            <tr>
                                                <td colSpan={8} className="text-center py-3">
                                                    <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                                                </td>
                                            </tr>
                                        ) : historialIngresos.length === 0 ? (
                                            <tr>
                                                <td colSpan={8} className="text-center text-body-secondary py-3">
                                                    No hay movimientos registrados aún.
                                                </td>
                                            </tr>
                                        ) : (
                                            historialIngresos.map((item) => {
                                                const esIngreso = !item.lugar?.toLowerCase().includes('egreso');
                                                const lugarparsed = item.lugar || '';
                                                const precioItem = Number(item.precioUnitario || 0);
                                                const importeItem = Number(item.importeTotal || 0);
                                                return (
                                                    <tr key={item.id}>
                                                        <td className="fw-medium">{fmtFecha(item.fechaCarga)}</td>
                                                        <td>
                                                            <span className={`badge ${esIngreso ? 'text-bg-success' : 'text-bg-warning'}`}>
                                                                <i className={`bi bi-arrow-${esIngreso ? 'up' : 'down'}-circle me-1`}></i>
                                                                {esIngreso ? 'Ingreso' : 'Egreso'}
                                                            </span>
                                                        </td>
                                                        <td className="text-body-secondary">
                                                            {lugarparsed && lugarparsed !== 'Predio Omar Godoy' && lugarparsed !== 'Ingreso de combustible' && lugarparsed !== 'Egreso / corrección'
                                                                ? lugarparsed
                                                                : <span className="text-body-tertiary fst-italic">—</span>
                                                            }
                                                        </td>
                                                        <td className="text-end fw-semibold">
                                                            <span className={esIngreso ? 'text-success' : 'text-warning'}>
                                                                {esIngreso ? '+' : '-'}{fmtLitros(item.litros)} L
                                                            </span>
                                                        </td>
                                                        <td className="text-end text-body-secondary">
                                                            {precioItem > 0 ? `$${fmtMoney(precioItem)}` : <span className="text-body-tertiary">—</span>}
                                                        </td>
                                                        <td className="text-end fw-semibold">
                                                            {importeItem > 0
                                                                ? <span className="text-primary">${fmtMoney(importeItem)}</span>
                                                                : <span className="text-body-tertiary">—</span>
                                                            }
                                                        </td>
                                                        <td className="text-body-secondary small">
                                                            {item.observaciones ? (
                                                                <span title={item.observaciones}>
                                                                    {item.observaciones.length > 50
                                                                        ? item.observaciones.slice(0, 50) + '…'
                                                                        : item.observaciones
                                                                    }
                                                                </span>
                                                            ) : <span className="text-body-tertiary">—</span>}
                                                        </td>
                                                        <td className="text-body-secondary small">
                                                            {item?.camionero?.nombre || '—'}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                <div className="table-responsive">
                    <table className="table table-sm table-hover align-middle mb-0">
                        <thead>
                            <tr>
                                <th>Camión</th>
                                <th className="text-end">Cargas</th>
                                <th className="text-end">Desde predio</th>
                                <th className="text-end">Externo</th>
                                <th className="text-end">Total litros</th>
                                <th className="text-end">Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-3">
                                        <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                                    </td>
                                </tr>
                            ) : resumen.detallePorCamion.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center text-body-secondary py-3">No hay cargas registradas para el mes seleccionado.</td>
                                </tr>
                            ) : (
                                resumen.detallePorCamion.map((row) => (
                                    <tr key={row.camionId}>
                                        <td>
                                            <strong>{row?.camion?.patente || `Camión #${row.camionId}`}</strong>
                                            <div className="small text-body-secondary">{row?.camion?.marca || ''} {row?.camion?.modelo || ''}</div>
                                        </td>
                                        <td className="text-end">{row.cantidadCargas}</td>
                                        <td className="text-end text-primary">{fmtLitros(row.totalPredio)} L</td>
                                        <td className="text-end text-secondary">{fmtLitros(row.totalExterno)} L</td>
                                        <td className="text-end fw-semibold">{fmtLitros(row.totalLitros)} L</td>
                                        <td className="text-end">
                                            <button className="btn btn-sm btn-outline-primary" onClick={() => openDetalleCamion(row)}>
                                                Ver detalle
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className={`modal ${detalleModal.open ? 'show d-block' : 'fade'}`} tabIndex="-1" aria-hidden={!detalleModal.open}>
                <div className="modal-dialog modal-lg modal-dialog-scrollable">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">
                                Detalle de combustible - {detalleModal?.camion?.patente || 'Camión'}
                            </h1>
                            <button type="button" className="btn-close" onClick={() => { setDetalleModal(detalleModalVacio); setEdicionCarga(edicionVacia); }}></button>
                        </div>
                        <div className="modal-body">
                            {detalleModal.loading ? (
                                <div className="text-center py-3"><span className="spinner-border spinner-border-sm text-secondary" role="status" /></div>
                            ) : (
                                <>
                                    <div className="mb-2 small text-body-secondary">
                                        Total cargado: <strong>{fmtLitros(detalleModal.totalLitros)} L</strong>
                                    </div>
                                    <div className="mb-2 small text-body-secondary">
                                        Total importe: <strong>$ {fmtMoney(detalleModal.totalImporte)}</strong>
                                    </div>
                                    <div className="mb-2 small text-body-secondary">
                                        Precio unitario de predio vigente (solo nuevas cargas): <strong>$ {fmtMoney(detalleModal.precioUnitarioPredio)}</strong>
                                    </div>
                                    <div className="table-responsive">
                                        <table className="table table-sm align-middle">
                                            <thead>
                                                <tr>
                                                    <th>Fecha</th>
                                                    <th>Lugar</th>
                                                    <th>Observaciones</th>
                                                    <th className="text-end">Litros</th>
                                                    <th className="text-end">Precio unitario</th>
                                                    <th className="text-end">Total</th>
                                                    <th>Origen</th>
                                                    <th>Camionero</th>
                                                    <th className="text-end">Acción</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {detalleModal.cargas.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={9} className="text-center text-body-secondary py-3">No hay cargas para este camión en el período.</td>
                                                    </tr>
                                                ) : (
                                                    detalleModal.cargas.map((c) => (
                                                        <tr key={c.id}>
                                                            <td>{fmtFecha(c.fechaCarga)}</td>
                                                            <td>{c.origen === 'predio' ? 'Carga predio' : 'Carga externa'}</td>
                                                            <td>{c.observaciones || '-'}</td>
                                                            <td className="text-end fw-semibold">{fmtLitros(c.litros)} L</td>
                                                            <td className="text-end">$ {fmtMoney(c.precioUnitarioAplicado ?? c.precioUnitario)}</td>
                                                            <td className="text-end fw-semibold">$ {fmtMoney(c.importeTotalAplicado ?? (c.importeTotal || (Number(c.litros || 0) * Number(c.precioUnitario || 0))))}</td>
                                                            <td>
                                                                <span className={`badge ${c.origen === 'predio' ? 'text-bg-primary' : 'text-bg-secondary'}`}>
                                                                    {c.origen === 'predio' ? 'Predio' : 'Externo'}
                                                                </span>
                                                            </td>
                                                            <td>{c?.camionero?.nombre || '-'}</td>
                                                            <td className="text-end">
                                                                <button
                                                                    type="button"
                                                                    className="btn btn-sm btn-outline-primary"
                                                                    onClick={() => abrirEdicionCarga(c)}
                                                                >
                                                                    Editar
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {edicionCarga.id ? (
                                        <div className="border rounded p-3 mt-3 bg-body-tertiary">
                                            <div className="fw-semibold mb-2">Editar carga #{edicionCarga.id}</div>
                                            <div className="row g-2">
                                                <div className="col-12 col-md-3">
                                                    <label className="form-label mb-1">Fecha</label>
                                                    <input
                                                        type="date"
                                                        className="form-control form-control-sm"
                                                        value={edicionCarga.fechaCarga}
                                                        onChange={(e) => setEdicionCarga((prev) => ({ ...prev, fechaCarga: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-12 col-md-3">
                                                    <label className="form-label mb-1">Camión</label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={edicionCarga.camionId}
                                                        onChange={(e) => setEdicionCarga((prev) => ({ ...prev, camionId: e.target.value }))}
                                                    >
                                                        <option value="">Seleccionar</option>
                                                        {camionesCombustible.map((camion) => (
                                                            <option key={camion.id} value={camion.id}>{camion.patente}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="col-12 col-md-2">
                                                    <label className="form-label mb-1">Origen</label>
                                                    <select
                                                        className="form-select form-select-sm"
                                                        value={edicionCarga.origen}
                                                        onChange={(e) => setEdicionCarga((prev) => ({ ...prev, origen: e.target.value }))}
                                                    >
                                                        <option value="externo">Externo</option>
                                                        <option value="predio">Predio</option>
                                                    </select>
                                                </div>
                                                <div className="col-12 col-md-2">
                                                    <label className="form-label mb-1">Litros</label>
                                                    <input
                                                        type="number"
                                                        min={0.01}
                                                        step={0.01}
                                                        className="form-control form-control-sm"
                                                        value={edicionCarga.litros}
                                                        onChange={(e) => setEdicionCarga((prev) => ({ ...prev, litros: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-12 col-md-2">
                                                    <label className="form-label mb-1">Precio unitario</label>
                                                    <input
                                                        type="number"
                                                        min={0.01}
                                                        step={0.01}
                                                        className="form-control form-control-sm"
                                                        value={edicionCarga.precioUnitario}
                                                        onChange={(e) => setEdicionCarga((prev) => ({ ...prev, precioUnitario: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="col-12">
                                                    <label className="form-label mb-1">Observaciones</label>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        value={edicionCarga.observaciones}
                                                        onChange={(e) => setEdicionCarga((prev) => ({ ...prev, observaciones: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                            <div className="d-flex justify-content-end gap-2 mt-3">
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-secondary"
                                                    onClick={() => setEdicionCarga(edicionVacia)}
                                                    disabled={editandoCarga}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    type="button"
                                                    className="btn btn-sm btn-primary"
                                                    onClick={guardarEdicionCarga}
                                                    disabled={editandoCarga}
                                                >
                                                    {editandoCarga ? 'Guardando…' : 'Guardar cambios'}
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {detalleModal.open && <div className="modal-backdrop show"></div>}
        </div>
    );
}

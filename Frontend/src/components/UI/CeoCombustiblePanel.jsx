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

    const [ajusteForm, setAjusteForm] = useState({ litros: '', tipo: 'ingreso', observaciones: '' });
    const [ajustando, setAjustando] = useState(false);

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
        if (!ajusteForm.litros) {
            showToast?.('Ingresá litros para el ajuste', 'warning');
            return;
        }
        try {
            setAjustando(true);
            await api.post('/combustible/predio/ajuste', {
                litros: Number(ajusteForm.litros),
                tipo: ajusteForm.tipo,
                observaciones: ajusteForm.observaciones || ''
            });
            showToast?.('Stock de predio actualizado', 'success');
            setAjusteForm({ litros: '', tipo: 'ingreso', observaciones: '' });
            await fetchResumen();
        } catch (e) {
            showToast?.(e?.response?.data?.error || 'Error ajustando stock de predio', 'error');
        } finally {
            setAjustando(false);
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

                <form onSubmit={handleAjuste} className="row g-2 align-items-end mb-3">
                    <div className="col-12 col-md-2">
                        <label className="form-label mb-1">Tipo ajuste</label>
                        <select
                            className="form-select form-select-sm"
                            value={ajusteForm.tipo}
                            onChange={(e) => setAjusteForm((prev) => ({ ...prev, tipo: e.target.value }))}
                        >
                            <option value="ingreso">Ingreso</option>
                            <option value="egreso">Egreso</option>
                        </select>
                    </div>
                    <div className="col-12 col-md-2">
                        <label className="form-label mb-1">Litros</label>
                        <input
                            className="form-control form-control-sm"
                            type="number"
                            min={0.01}
                            step={0.01}
                            value={ajusteForm.litros}
                            onChange={(e) => setAjusteForm((prev) => ({ ...prev, litros: e.target.value }))}
                            placeholder="Ej: 500"
                        />
                    </div>
                    <div className="col-12 col-md-6">
                        <label className="form-label mb-1">Observación</label>
                        <input
                            className="form-control form-control-sm"
                            value={ajusteForm.observaciones}
                            onChange={(e) => setAjusteForm((prev) => ({ ...prev, observaciones: e.target.value }))}
                            placeholder="Compra de gasoil / corrección de stock"
                        />
                    </div>
                    <div className="col-12 col-md-2 d-grid">
                        <button className="btn btn-sm btn-outline-primary" type="submit" disabled={ajustando}>
                            {ajustando ? 'Guardando…' : 'Aplicar ajuste'}
                        </button>
                    </div>
                </form>

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

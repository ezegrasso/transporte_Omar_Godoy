import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { useToast } from '../context/ToastContext';
import { downloadCSV } from '../utils/csv';

export default function Camionero() {
    const [pendientes, setPendientes] = useState([]);
    const [mios, setMios] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [finalizarData, setFinalizarData] = useState({ km: '', combustible: '' });
    const [takingId, setTakingId] = useState(null);
    const [finishingId, setFinishingId] = useState(null);
    const [filtroPend, setFiltroPend] = useState('');
    const [filtroMios, setFiltroMios] = useState('');
    const [pagePend, setPagePend] = useState(1);
    const [pageMios, setPageMios] = useState(1);
    const pageSize = 10;
    const [modalId, setModalId] = useState(null);
    const [sortPend, setSortPend] = useState({ key: 'fecha', dir: 'asc' });
    const [sortMios, setSortMios] = useState({ key: 'fecha', dir: 'desc' });
    const { showToast } = useToast();
    const [savedMioId, setSavedMioId] = useState(null);

    const fetchPendientes = async () => {
        const { data } = await api.get('/api/viajes?estado=pendiente&limit=100');
        setPendientes(data.items || []);
    };
    const fetchMios = async () => {
        const { data } = await api.get('/api/viajes?estado=en_curso&limit=100');
        setMios(data.items || []);
    };

    useEffect(() => {
        (async () => {
            setLoading(true);
            setError('');
            try { await Promise.all([fetchPendientes(), fetchMios()]); }
            catch (e) { setError(e?.response?.data?.error || 'Error cargando viajes'); }
            finally { setLoading(false); }
        })();
    }, []);

    const pendientesFiltrados = useMemo(() => {
        const term = filtroPend.trim().toLowerCase();
        return pendientes.filter(v => !term || `${v.origen ?? ''} ${v.destino ?? ''} ${v.camion?.patente ?? v.camionId ?? ''}`.toLowerCase().includes(term));
    }, [pendientes, filtroPend]);
    const pendientesOrdenados = useMemo(() => {
        const arr = [...pendientesFiltrados];
        const dir = sortPend.dir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            const getVal = (v, k) => {
                switch (k) {
                    case 'fecha': return new Date(v.fecha || 0).getTime();
                    case 'origen': return (v.origen || '').toLowerCase();
                    case 'destino': return (v.destino || '').toLowerCase();
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
        return mios.filter(v => !term || `${v.origen ?? ''} ${v.destino ?? ''} ${v.camion?.patente ?? v.camionId ?? ''}`.toLowerCase().includes(term));
    }, [mios, filtroMios]);
    const miosOrdenados = useMemo(() => {
        const arr = [...miosFiltrados];
        const dir = sortMios.dir === 'asc' ? 1 : -1;
        arr.sort((a, b) => {
            const getVal = (v, k) => {
                switch (k) {
                    case 'fecha': return new Date(v.fecha || 0).getTime();
                    case 'origen': return (v.origen || '').toLowerCase();
                    case 'destino': return (v.destino || '').toLowerCase();
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

    const tomar = async (id) => {
        setError('');
        setTakingId(id);
        try {
            await api.patch(`/api/viajes/${id}/tomar`);
            await Promise.all([fetchPendientes(), fetchMios()]);
            showToast('Viaje tomado', 'success');
            setSavedMioId(id);
            setTimeout(() => setSavedMioId(null), 2000);
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
        setFinishingId(id);
        try {
            const body = { km: Number(finalizarData.km), combustible: Number(finalizarData.combustible) };
            await api.patch(`/api/viajes/${id}/finalizar`, body);
            setFinalizarData({ km: '', combustible: '' });
            // Feedback visual antes de sacar la fila de la tabla
            setSavedMioId(id);
            await new Promise(r => setTimeout(r, 400));
            await Promise.all([fetchPendientes(), fetchMios()]);
            setTimeout(() => setSavedMioId(null), 2000);
            showToast('Viaje finalizado', 'success');
        } catch (e) {
            const msg = e?.response?.data?.error || 'No se pudo finalizar';
            setError(msg);
            showToast(msg, 'error');
        } finally {
            setFinishingId(null);
        }
    };

    return (
        <div className="container py-3 space-y-4">
            <div className="d-flex align-items-center justify-content-between">
                <h2 className="mb-0">Panel Camionero</h2>
                {loading && <span className="spinner-border spinner-border-sm text-secondary" role="status" />}
            </div>
            {error && <div className="alert alert-danger" role="alert">{error}</div>}

            <div className="card shadow-sm">
                <div className="card-body">
                    <div className="d-flex align-items-end gap-2 mb-3 flex-wrap">
                        <h3 className="h5 mb-0 me-auto">Viajes pendientes</h3>
                        <div>
                            <label className="form-label mb-1">Buscar</label>
                            <input className="form-control form-control-sm" placeholder="Origen, destino, patente" value={filtroPend} onChange={e => { setFiltroPend(e.target.value); setPagePend(1); }} />
                        </div>
                        <div className="ms-auto">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                const headers = ['Fecha', 'Origen', 'Destino', 'Camión']
                                const rows = pendientesOrdenados.map(v => [
                                    new Date(v.fecha).toLocaleDateString(), v.origen || '', v.destino || '', v.camion?.patente || v.camionId || ''
                                ])
                                downloadCSV('pendientes.csv', headers, rows)
                                showToast('Exportado pendientes', 'success')
                            }}>
                                <i className="bi bi-filetype-csv me-1"></i> Exportar
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-striped table-hover align-middle">
                            <thead>
                                <tr>
                                    {['fecha', 'origen', 'destino', 'camion'].map((k) => (
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
                                        <td>{new Date(v.fecha).toLocaleDateString()}</td>
                                        <td>{v.origen}</td>
                                        <td>{v.destino}</td>
                                        <td>{v.camion?.patente || v.camionId}</td>
                                        <td className="text-end">
                                            <button className="btn btn-sm btn-primary" onClick={() => tomar(v.id)} disabled={takingId === v.id}>
                                                {takingId === v.id ? 'Tomando…' : 'Tomar'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
                        <h3 className="h5 mb-0 me-auto">Mis viajes en curso</h3>
                        <div>
                            <label className="form-label mb-1">Buscar</label>
                            <input className="form-control form-control-sm" placeholder="Origen, destino, patente" value={filtroMios} onChange={e => { setFiltroMios(e.target.value); setPageMios(1); }} />
                        </div>
                        <div className="ms-auto">
                            <button className="btn btn-sm btn-outline-secondary" onClick={() => {
                                const headers = ['Fecha', 'Origen', 'Destino', 'Camión']
                                const rows = miosOrdenados.map(v => [
                                    new Date(v.fecha).toLocaleDateString(), v.origen || '', v.destino || '', v.camion?.patente || v.camionId || ''
                                ])
                                downloadCSV('en_curso.csv', headers, rows)
                                showToast('Exportado en curso', 'success')
                            }}>
                                <i className="bi bi-filetype-csv me-1"></i> Exportar
                            </button>
                        </div>
                    </div>
                    <div className="table-responsive">
                        <table className="table table-striped table-hover align-middle">
                            <thead>
                                <tr>
                                    {['fecha', 'origen', 'destino', 'camion'].map((k) => (
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
                                    <tr key={v.id} className={savedMioId === v.id ? 'table-success row-saved-anim' : ''}>
                                        <td>{new Date(v.fecha).toLocaleDateString()}</td>
                                        <td>{v.origen}</td>
                                        <td>{v.destino}</td>
                                        <td>{v.camion?.patente || v.camionId}</td>
                                        <td colSpan={3} className="text-end">
                                            <button className="btn btn-sm btn-success" data-bs-toggle="modal" data-bs-target="#modalFinalizar" onClick={() => { setModalId(v.id); setFinalizarData({ km: '', combustible: '' }); }}>Finalizar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
            <div className="modal fade" id="modalFinalizar" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h1 className="modal-title fs-5">Finalizar viaje</h1>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body">
                            <div className="row g-2">
                                <div className="col-6">
                                    <label className="form-label">Km</label>
                                    <input className="form-control" type="number" value={finalizarData.km} onChange={e => setFinalizarData(x => ({ ...x, km: e.target.value }))} />
                                </div>
                                <div className="col-6">
                                    <label className="form-label">Combustible</label>
                                    <input className="form-control" type="number" value={finalizarData.combustible} onChange={e => setFinalizarData(x => ({ ...x, combustible: e.target.value }))} />
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">Cancelar</button>
                            <button type="button" className="btn btn-success" disabled={!modalId || finishingId === modalId} data-bs-dismiss="modal" onClick={() => modalId && finalizar(modalId)}>
                                {finishingId === modalId ? 'Finalizando…' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

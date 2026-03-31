import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/UI/PageHeader';
import StatCard from '../components/UI/StatCard';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { generarReporteFinanzasPDF } from '../utils/pdf';
import './Finanzas.css';

const STORAGE_KEY = 'finanzas.gastosFijos.v1';
const TREND_WIDTH = 520;
const TREND_HEIGHT = 170;
const TREND_PADDING = 20;

const getMesActual = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMesesTendencia = (mesBase, cantidad = 6) => {
    const [year, month] = String(mesBase || '').split('-').map(Number);
    if (!year || !month) return [];
    const out = [];
    for (let i = cantidad - 1; i >= 0; i -= 1) {
        const d = new Date(year, month - 1 - i, 1);
        out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return out;
};

const mesLabelCorto = (mesISO) => {
    try {
        const [year, month] = String(mesISO || '').split('-').map(Number);
        const d = new Date(year, (month || 1) - 1, 1);
        const raw = d.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
        return raw.charAt(0).toUpperCase() + raw.slice(1);
    } catch {
        return mesISO;
    }
};

const toNum = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const formatearMoneda = (value) => {
    const n = toNum(value);
    return `$ ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatearNumero = (value) => {
    const n = toNum(value);
    return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const getGastosFijosFromStorage = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return typeof parsed === 'object' && parsed ? parsed : {};
    } catch {
        return {};
    }
};

export default function Finanzas() {
    const { user } = useAuth();
    const [mes, setMes] = useState(getMesActual);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [resumen, setResumen] = useState(null);
    const [tendencia, setTendencia] = useState({ loading: false, error: '', data: [] });
    const [hoveredTrendIndex, setHoveredTrendIndex] = useState(null);

    const [gastosFijosByMes, setGastosFijosByMes] = useState(() => getGastosFijosFromStorage());
    const [nuevoGasto, setNuevoGasto] = useState({ nombre: '', monto: '' });

    const gastosFijosMes = useMemo(() => gastosFijosByMes[mes] || [], [gastosFijosByMes, mes]);

    const totalGastosFijos = useMemo(
        () => gastosFijosMes.reduce((sum, item) => sum + toNum(item?.monto), 0),
        [gastosFijosMes]
    );

    const totalGastosSistema = toNum(resumen?.resumen?.totalGastosSistema);
    const totalIngresos = toNum(resumen?.resumen?.ingresosTotales);
    const utilidadOperativa = toNum(resumen?.resumen?.utilidadOperativa);

    const totalGastosEmpresa = totalGastosSistema + totalGastosFijos;
    const utilidadNeta = totalIngresos - totalGastosEmpresa;
    const margenNeto = totalIngresos > 0 ? (utilidadNeta / totalIngresos) * 100 : 0;
    const mesesTendencia = useMemo(() => getMesesTendencia(mes, 6), [mes]);

    const mesLabel = useMemo(() => {
        try {
            const [year, month] = String(mes || '').split('-').map(Number);
            const d = new Date(year, (month || 1) - 1, 1);
            const raw = d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
            return raw.charAt(0).toUpperCase() + raw.slice(1);
        } catch {
            return mes;
        }
    }, [mes]);

    const saludFinanciera = useMemo(() => {
        if (margenNeto >= 20) return { label: 'Excelente', className: 'text-bg-success' };
        if (margenNeto >= 10) return { label: 'Saludable', className: 'text-bg-primary' };
        if (margenNeto >= 0) return { label: 'Ajustado', className: 'text-bg-warning' };
        return { label: 'En riesgo', className: 'text-bg-danger' };
    }, [margenNeto]);

    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(gastosFijosByMes));
    }, [gastosFijosByMes]);

    useEffect(() => {
        const fetchResumen = async () => {
            setLoading(true);
            setError('');
            try {
                const { data } = await api.get('/finanzas/resumen-mensual', { params: { mes } });
                setResumen(data);
            } catch (e) {
                setResumen(null);
                setError(e?.response?.data?.error || 'No se pudo cargar el resumen financiero.');
            } finally {
                setLoading(false);
            }
        };

        fetchResumen();
    }, [mes]);

    useEffect(() => {
        let active = true;
        const fetchTendencia = async () => {
            if (!mesesTendencia.length) return;
            setTendencia({ loading: true, error: '', data: [] });
            try {
                const rows = await Promise.all(
                    mesesTendencia.map(async (itemMes) => {
                        const { data } = await api.get('/finanzas/resumen-mensual', { params: { mes: itemMes } });
                        const ingresos = toNum(data?.resumen?.ingresosTotales);
                        const gastosSistemaMes = toNum(data?.resumen?.totalGastosSistema);
                        const gastosFijosMesLocal = (gastosFijosByMes[itemMes] || []).reduce((sum, g) => sum + toNum(g?.monto), 0);
                        const gastosEmpresaMes = gastosSistemaMes + gastosFijosMesLocal;
                        return {
                            mes: itemMes,
                            label: mesLabelCorto(itemMes),
                            ingresos,
                            gastos: gastosEmpresaMes,
                            utilidad: ingresos - gastosEmpresaMes
                        };
                    })
                );
                if (!active) return;
                setTendencia({ loading: false, error: '', data: rows });
            } catch (e) {
                if (!active) return;
                setTendencia({ loading: false, error: 'No se pudo cargar la tendencia mensual.', data: [] });
            }
        };

        fetchTendencia();
        return () => {
            active = false;
        };
    }, [mesesTendencia, gastosFijosByMes]);

    const agregarGastoFijo = (e) => {
        e.preventDefault();
        const nombre = String(nuevoGasto.nombre || '').trim();
        const monto = toNum(String(nuevoGasto.monto || '').replace(',', '.'));
        if (!nombre || monto <= 0) return;

        setGastosFijosByMes((prev) => {
            const actual = prev[mes] || [];
            const nextItem = { id: Date.now(), nombre, monto: Number(monto.toFixed(2)) };
            return { ...prev, [mes]: [...actual, nextItem] };
        });
        setNuevoGasto({ nombre: '', monto: '' });
    };

    const eliminarGastoFijo = (id) => {
        setGastosFijosByMes((prev) => {
            const actual = prev[mes] || [];
            return { ...prev, [mes]: actual.filter((item) => item.id !== id) };
        });
    };

    const gastosSistema = resumen?.gastosSistema || {};
    const facturacionPorCamionero = resumen?.facturacionPorCamionero || [];
    const facturacionPorCliente = resumen?.facturacionPorCliente || [];

    const totalesCamioneros = useMemo(() => {
        return facturacionPorCamionero.reduce((acc, row) => {
            const brutoLiquidacion = toNum(row?.brutoLiquidacion ?? row?.bruto);
            acc.viajes += toNum(row?.viajes);
            acc.brutoLiquidacion += brutoLiquidacion;
            acc.sueldo += toNum(row?.sueldo);
            acc.adelantos += toNum(row?.adelantos);
            acc.estadias += toNum(row?.estadias);
            acc.combustible += toNum(row?.combustibleImporte);
            acc.neto += toNum(row?.neto);
            return acc;
        }, {
            viajes: 0,
            brutoLiquidacion: 0,
            sueldo: 0,
            adelantos: 0,
            estadias: 0,
            combustible: 0,
            neto: 0
        });
    }, [facturacionPorCamionero]);

    const rentabilidadTotalCamioneros = useMemo(() => {
        if (totalesCamioneros.brutoLiquidacion <= 0) return 0;
        return (totalesCamioneros.neto / totalesCamioneros.brutoLiquidacion) * 100;
    }, [totalesCamioneros]);

    const totalesClientes = useMemo(() => {
        return facturacionPorCliente.reduce((acc, row) => {
            acc.viajes += toNum(row?.viajes);
            acc.total += toNum(row?.total);
            acc.cobradas += toNum(row?.cobradas);
            acc.pendientes += toNum(row?.pendientes);
            return acc;
        }, {
            viajes: 0,
            total: 0,
            cobradas: 0,
            pendientes: 0
        });
    }, [facturacionPorCliente]);

    const tendenciaMax = useMemo(() => {
        const values = (tendencia.data || []).flatMap((d) => [toNum(d.ingresos), toNum(d.gastos), Math.abs(toNum(d.utilidad))]);
        const max = Math.max(...values, 1);
        return max;
    }, [tendencia.data]);

    const getSeriesPoints = (key, width = TREND_WIDTH, height = TREND_HEIGHT, padding = TREND_PADDING) => {
        const series = tendencia.data || [];
        if (!series.length) return [];
        const step = series.length > 1 ? (width - (padding * 2)) / (series.length - 1) : 0;
        return series
            .map((d, idx) => {
                const x = padding + (idx * step);
                const y = (height - padding) - ((toNum(d[key]) / tendenciaMax) * (height - (padding * 2)));
                return { x, y, mes: d.mes, label: d.label, value: toNum(d[key]) };
            });
    };

    const trendPoints = useMemo(() => ({
        ingresos: getSeriesPoints('ingresos'),
        gastos: getSeriesPoints('gastos'),
        utilidad: getSeriesPoints('utilidad')
    }), [tendencia.data, tendenciaMax]);

    const getPolylinePoints = (key) => (trendPoints[key] || []).map((p) => `${p.x},${p.y}`).join(' ');

    const renderSeriesDots = (key, className, label) => (trendPoints[key] || []).map((p, idx) => (
        <circle
            key={`${key}-${p.mes}`}
            cx={p.x}
            cy={p.y}
            r={hoveredTrendIndex === idx ? '4.8' : '3.6'}
            className={`${className} ${hoveredTrendIndex === idx ? 'trend-dot-active' : ''}`}
        >
            <title>{`${label} - ${p.label}: ${formatearMoneda(p.value)}`}</title>
        </circle>
    ));

    const hoveredTrend = useMemo(() => {
        if (hoveredTrendIndex == null || !tendencia.data?.[hoveredTrendIndex]) return null;
        const item = tendencia.data[hoveredTrendIndex];
        const basePoint = trendPoints.ingresos?.[hoveredTrendIndex] || null;
        if (!basePoint) return null;

        const tooltipWidth = 210;
        const offsetX = 20;
        const offsetY = 12;
        const maxLeft = TREND_WIDTH - tooltipWidth - 6;
        const left = Math.max(6, Math.min(basePoint.x + offsetX, maxLeft));
        const top = Math.max(6, basePoint.y - offsetY - 82);

        return {
            ...item,
            x: basePoint.x,
            y: basePoint.y,
            left,
            top
        };
    }, [hoveredTrendIndex, tendencia.data, trendPoints.ingresos]);

    const getRentabilidadMeta = (row) => {
        const bruto = toNum(row?.brutoLiquidacion ?? row?.bruto);
        const neto = toNum(row?.neto);
        if (bruto <= 0) {
            return { ratio: 0, label: 'Sin base', rowClass: 'finanzas-row-neutral', badgeClass: 'text-bg-secondary' };
        }
        const ratio = (neto / bruto) * 100;
        if (ratio >= 18) return { ratio, label: 'Excelente', rowClass: 'finanzas-row-excelente', badgeClass: 'text-bg-success' };
        if (ratio >= 8) return { ratio, label: 'Ajustado', rowClass: 'finanzas-row-ajustado', badgeClass: 'text-bg-warning' };
        return { ratio, label: 'Crítico', rowClass: 'finanzas-row-critico', badgeClass: 'text-bg-danger' };
    };

    const exportarPDF = () => {
        if (!resumen) return;
        generarReporteFinanzasPDF({
            mes,
            resumen,
            gastosFijos: gastosFijosMes
        });
    };

    return (
        <div className="finanzas-page">
            <PageHeader
                title="Finanzas"
                subtitle="Control mensual profesional de ingresos, gastos y rentabilidad"
                actions={(
                    <div className="d-flex align-items-center gap-2 flex-wrap justify-content-end finanzas-actions">
                        <input
                            type="month"
                            className="form-control"
                            value={mes}
                            onChange={(e) => setMes(e.target.value)}
                            style={{ minWidth: 190 }}
                        />
                        <button
                            className="btn btn-primary text-nowrap"
                            type="button"
                            onClick={exportarPDF}
                            disabled={!resumen || loading}
                        >
                            <i className="bi bi-file-earmark-pdf me-1" /> Exportar reporte PDF
                        </button>
                        <Link className="btn btn-outline-secondary text-nowrap" to={user?.rol === 'ceo' ? '/ceo' : '/administracion'}>
                            Volver al panel
                        </Link>
                    </div>
                )}
                showUserMenu={true}
            />

            <div className="card border-0 shadow-sm mb-3 finanzas-hero">
                <div className="card-body d-flex flex-wrap justify-content-between align-items-center gap-3">
                    <div>
                        <div className="text-uppercase small fw-semibold text-secondary">Resultado Del Mes - {mesLabel}</div>
                        <div className={`display-6 fw-bold mb-1 ${utilidadNeta >= 0 ? 'text-success' : 'text-danger'}`}>
                            {formatearMoneda(utilidadNeta)}
                        </div>
                        <div className="d-flex align-items-center gap-2 flex-wrap">
                            <div className="small text-body-secondary mb-0">Margen neto: {formatearNumero(margenNeto)}%</div>
                            <span className={`badge ${saludFinanciera.className}`}>{saludFinanciera.label}</span>
                        </div>
                    </div>
                    <div className="d-flex gap-2 flex-wrap">
                        <span className="badge text-bg-light border finanzas-chip">Ingresos: {formatearMoneda(totalIngresos)}</span>
                        <span className="badge text-bg-light border finanzas-chip">Gastos sistema: {formatearMoneda(totalGastosSistema)}</span>
                        <span className="badge text-bg-light border finanzas-chip">Gastos fijos: {formatearMoneda(totalGastosFijos)}</span>
                        <span className="badge text-bg-light border finanzas-chip">Gastos empresa: {formatearMoneda(totalGastosEmpresa)}</span>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-danger">{error}</div>}
            {loading && (
                <div className="alert alert-info d-flex align-items-center gap-2">
                    <span className="spinner-border spinner-border-sm" role="status" />
                    Cargando datos financieros del mes...
                </div>
            )}

            <div className="row g-3 mb-4">
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-cash-coin" />} label="Ingresos Totales" value={formatearMoneda(totalIngresos)} hint="Facturación consolidada" />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-wallet2" />} label="Ingresos Cobrados" value={formatearMoneda(toNum(resumen?.resumen?.ingresosCobrados))} hint="Facturas cobradas" />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-hourglass-split" />} label="Pendiente De Cobro" value={formatearMoneda(toNum(resumen?.resumen?.ingresosPendientes))} hint="Facturas pendientes" />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-graph-up-arrow" />} label="Utilidad Operativa" value={formatearMoneda(utilidadOperativa)} hint="Sin gastos fijos" />
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-building" />} label="Gastos Fijos" value={formatearMoneda(totalGastosFijos)} hint="Configurables por mes" />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-calculator" />} label="Gastos Empresa" value={formatearMoneda(totalGastosEmpresa)} hint="Sistema + gastos fijos" />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-people" />} label="Camioneros Activos" value={formatearNumero(resumen?.indicadores?.cantidadCamionerosConMovimiento || 0)} hint="Con movimiento en el mes" />
                </div>
                <div className="col-12 col-md-6 col-xl-3">
                    <StatCard icon={<i className="bi bi-person-badge" />} label="Clientes Facturados" value={formatearNumero(resumen?.indicadores?.cantidadClientesFacturados || 0)} hint="Clientes con facturación" />
                </div>
            </div>

            <div className="card shadow-sm mb-4 finanzas-section-card">
                <div className="card-header bg-transparent border-0 pt-3 d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <div>
                        <h5 className="mb-0 d-flex align-items-center gap-2"><i className="bi bi-activity" /> Tendencia 6 Meses</h5>
                        <div className="small text-body-secondary">Ingresos vs gastos empresa vs utilidad neta</div>
                    </div>
                    <div className="d-flex align-items-center gap-2 small flex-wrap">
                        <span className="finanzas-legend"><i className="bi bi-dot text-primary" /> Ingresos</span>
                        <span className="finanzas-legend"><i className="bi bi-dot text-danger" /> Gastos</span>
                        <span className="finanzas-legend"><i className="bi bi-dot text-success" /> Utilidad</span>
                    </div>
                </div>
                <div className="card-body">
                    {tendencia.error && <div className="alert alert-warning py-2 mb-0">{tendencia.error}</div>}
                    {tendencia.loading && (
                        <div className="d-flex align-items-center gap-2 text-body-secondary">
                            <span className="spinner-border spinner-border-sm" role="status" />
                            Cargando tendencia...
                        </div>
                    )}
                    {!tendencia.loading && tendencia.data.length > 0 && (
                        <div className="finanzas-trend-wrap">
                            <svg
                                viewBox={`0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`}
                                className="finanzas-trend-svg"
                                role="img"
                                aria-label="Grafico de tendencia financiera"
                                onMouseLeave={() => setHoveredTrendIndex(null)}
                            >
                                <line x1={TREND_PADDING} y1={TREND_PADDING} x2={TREND_WIDTH - TREND_PADDING} y2={TREND_PADDING} className="trend-guide" />
                                <line x1={TREND_PADDING} y1={TREND_HEIGHT / 2} x2={TREND_WIDTH - TREND_PADDING} y2={TREND_HEIGHT / 2} className="trend-guide" />
                                <line x1={TREND_PADDING} y1={TREND_HEIGHT - TREND_PADDING} x2={TREND_WIDTH - TREND_PADDING} y2={TREND_HEIGHT - TREND_PADDING} className="trend-guide" />
                                {(trendPoints.ingresos || []).map((p, idx) => {
                                    const prev = trendPoints.ingresos[idx - 1];
                                    const next = trendPoints.ingresos[idx + 1];
                                    const xStart = idx === 0 ? TREND_PADDING : (prev.x + p.x) / 2;
                                    const xEnd = idx === trendPoints.ingresos.length - 1 ? TREND_WIDTH - TREND_PADDING : (p.x + next.x) / 2;
                                    return (
                                        <rect
                                            key={`hover-zone-${p.mes}`}
                                            x={xStart}
                                            y={TREND_PADDING}
                                            width={Math.max(1, xEnd - xStart)}
                                            height={TREND_HEIGHT - (TREND_PADDING * 2)}
                                            className="trend-hover-zone"
                                            onMouseEnter={() => setHoveredTrendIndex(idx)}
                                            onTouchStart={() => setHoveredTrendIndex(idx)}
                                            onClick={() => setHoveredTrendIndex(idx)}
                                        />
                                    );
                                })}
                                <polyline points={getPolylinePoints('ingresos')} className="trend-line trend-line-ingresos" />
                                <polyline points={getPolylinePoints('gastos')} className="trend-line trend-line-gastos" />
                                <polyline points={getPolylinePoints('utilidad')} className="trend-line trend-line-utilidad" />
                                {hoveredTrend && (
                                    <line x1={hoveredTrend.x} y1={TREND_PADDING} x2={hoveredTrend.x} y2={TREND_HEIGHT - TREND_PADDING} className="trend-guide-active" />
                                )}
                                {renderSeriesDots('ingresos', 'trend-dot trend-dot-ingresos', 'Ingresos')}
                                {renderSeriesDots('gastos', 'trend-dot trend-dot-gastos', 'Gastos')}
                                {renderSeriesDots('utilidad', 'trend-dot trend-dot-utilidad', 'Utilidad')}
                            </svg>
                            {hoveredTrend && (
                                <div className="finanzas-trend-tooltip" style={{ left: hoveredTrend.left, top: hoveredTrend.top }}>
                                    <div className="fw-semibold mb-1">{hoveredTrend.label}</div>
                                    <div className="d-flex justify-content-between gap-3 small">
                                        <span className="text-primary">Ingresos</span>
                                        <span>{formatearMoneda(hoveredTrend.ingresos)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between gap-3 small">
                                        <span className="text-danger">Gastos</span>
                                        <span>{formatearMoneda(hoveredTrend.gastos)}</span>
                                    </div>
                                    <div className="d-flex justify-content-between gap-3 small">
                                        <span className="text-success">Utilidad</span>
                                        <span>{formatearMoneda(hoveredTrend.utilidad)}</span>
                                    </div>
                                </div>
                            )}
                            <div className="finanzas-trend-labels">
                                {tendencia.data.map((item) => (
                                    <span key={item.mes} className="small text-body-secondary">{item.label}</span>
                                ))}
                            </div>
                            <div className="finanzas-trend-pills">
                                {tendencia.data.map((item, idx) => (
                                    <button
                                        key={`pill-${item.mes}`}
                                        type="button"
                                        className={`btn btn-sm ${hoveredTrendIndex === idx ? 'btn-primary' : 'btn-outline-secondary'}`}
                                        onClick={() => setHoveredTrendIndex(idx)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="row g-3 mb-4">
                <div className="col-12 col-lg-7">
                    <div className="card shadow-sm h-100 finanzas-section-card">
                        <div className="card-header bg-transparent border-0 pt-3">
                            <h5 className="mb-0 d-flex align-items-center gap-2"><i className="bi bi-bar-chart-line" /> Gastos Del Sistema</h5>
                            <div className="small text-body-secondary">Costos automáticos detectados en el sistema</div>
                        </div>
                        <div className="card-body">
                            <div className="d-flex justify-content-between py-2 border-bottom">
                                <span>Sueldos camioneros</span>
                                <strong>{formatearMoneda(gastosSistema.sueldosCamioneros)}</strong>
                            </div>
                            <div className="d-flex justify-content-between py-2 border-bottom">
                                <span>Combustible</span>
                                <strong>{formatearMoneda(gastosSistema.combustible)}</strong>
                            </div>
                            <div className="d-flex justify-content-between py-2 border-bottom">
                                <span>Comisiones intermediarios</span>
                                <strong>{formatearMoneda(gastosSistema.comisionesIntermediarios)}</strong>
                            </div>
                            <div className="d-flex justify-content-between py-2 mt-2">
                                <span className="fw-semibold">Total gastos sistema</span>
                                <strong>{formatearMoneda(totalGastosSistema)}</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="col-12 col-lg-5">
                    <div className="card shadow-sm h-100 finanzas-section-card">
                        <div className="card-header bg-transparent border-0 pt-3">
                            <h5 className="mb-0 d-flex align-items-center gap-2"><i className="bi bi-buildings" /> Gastos Fijos Mensuales</h5>
                            <div className="small text-body-secondary">Luz, alquiler, sueldos administrativos, seguros y más</div>
                        </div>
                        <div className="card-body">
                            <form className="row g-2 mb-3" onSubmit={agregarGastoFijo}>
                                <div className="col-7">
                                    <input
                                        className="form-control"
                                        placeholder="Concepto (ej: Luz)"
                                        value={nuevoGasto.nombre}
                                        onChange={(e) => setNuevoGasto((p) => ({ ...p, nombre: e.target.value }))}
                                    />
                                </div>
                                <div className="col-5">
                                    <input
                                        className="form-control"
                                        placeholder="Monto"
                                        value={nuevoGasto.monto}
                                        onChange={(e) => setNuevoGasto((p) => ({ ...p, monto: e.target.value }))}
                                    />
                                </div>
                                <div className="col-12 d-grid">
                                    <button className="btn btn-primary" type="submit">
                                        Agregar gasto fijo
                                    </button>
                                </div>
                            </form>

                            <div className="table-responsive" style={{ maxHeight: 220 }}>
                                <table className="table table-sm align-middle mb-0 finanzas-mobile-card-table finanzas-mobile-card-table-sm">
                                    <thead>
                                        <tr>
                                            <th>Concepto</th>
                                            <th className="text-end">Monto</th>
                                            <th className="text-end">Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gastosFijosMes.length === 0 && (
                                            <tr>
                                                <td colSpan={3} className="text-body-secondary text-center py-3">Sin gastos fijos cargados para este mes.</td>
                                            </tr>
                                        )}
                                        {gastosFijosMes.map((item) => (
                                            <tr key={item.id}>
                                                <td data-label="Concepto">{item.nombre}</td>
                                                <td className="text-end" data-label="Monto">{formatearMoneda(item.monto)}</td>
                                                <td className="text-end" data-label="Acción">
                                                    <button
                                                        className="btn btn-sm btn-outline-danger"
                                                        onClick={() => eliminarGastoFijo(item.id)}
                                                        type="button"
                                                    >
                                                        <i className="bi bi-trash" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="d-flex justify-content-between mt-3">
                                <span className="fw-semibold">Total gastos fijos</span>
                                <strong>{formatearMoneda(totalGastosFijos)}</strong>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm mb-4 finanzas-section-card">
                <div className="card-header bg-transparent border-0 pt-3">
                    <h5 className="mb-0 d-flex align-items-center gap-2"><i className="bi bi-truck" /> Facturación Y Liquidación Por Camionero</h5>
                    <div className="small text-body-secondary">Viajes, bruto de liquidación, sueldo, adelantos, estadías, combustible y neto mensual</div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover table-striped align-middle mb-0 finanzas-mobile-card-table">
                            <thead>
                                <tr>
                                    <th>Camionero</th>
                                    <th className="text-end">Viajes</th>
                                    <th className="text-end">Bruto (liq.)</th>
                                    <th className="text-end">Sueldo</th>
                                    <th className="text-end">Adelantos</th>
                                    <th className="text-end">Estadías</th>
                                    <th className="text-end">Combustible</th>
                                    <th className="text-end">Neto</th>
                                    <th className="text-end">Rentabilidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                {facturacionPorCamionero.length === 0 && (
                                    <tr>
                                        <td colSpan={9} className="text-center py-4 text-body-secondary">Sin movimientos para el período seleccionado.</td>
                                    </tr>
                                )}
                                {facturacionPorCamionero.map((row) => {
                                    const rentabilidad = getRentabilidadMeta(row);
                                    return (
                                        <tr key={`${row.camioneroId || 'none'}-${row.camioneroNombre}`} className={rentabilidad.rowClass}>
                                            <td data-label="Camionero">{row.camioneroNombre}</td>
                                            <td className="text-end" data-label="Viajes">{row.viajes}</td>
                                            <td className="text-end" data-label="Bruto (liq.)">{formatearMoneda(row.brutoLiquidacion ?? row.bruto)}</td>
                                            <td className="text-end" data-label="Sueldo">{formatearMoneda(row.sueldo)}</td>
                                            <td className="text-end text-danger" data-label="Adelantos">-{formatearMoneda(row.adelantos)}</td>
                                            <td className="text-end text-success" data-label="Estadías">+{formatearMoneda(row.estadias)}</td>
                                            <td className="text-end" data-label="Combustible">{formatearMoneda(row.combustibleImporte)}</td>
                                            <td className="text-end fw-semibold" data-label="Neto">{formatearMoneda(row.neto)}</td>
                                            <td className="text-end" data-label="Rentabilidad">
                                                <span className={`badge ${rentabilidad.badgeClass} me-1`}>{rentabilidad.label}</span>
                                                <span className="small text-body-secondary">{formatearNumero(rentabilidad.ratio)}%</span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                            {facturacionPorCamionero.length > 0 && (
                                <tfoot>
                                    <tr className="fw-semibold">
                                        <td>Total</td>
                                        <td className="text-end">{formatearNumero(totalesCamioneros.viajes)}</td>
                                        <td className="text-end">{formatearMoneda(totalesCamioneros.brutoLiquidacion)}</td>
                                        <td className="text-end">{formatearMoneda(totalesCamioneros.sueldo)}</td>
                                        <td className="text-end text-danger">-{formatearMoneda(totalesCamioneros.adelantos)}</td>
                                        <td className="text-end text-success">+{formatearMoneda(totalesCamioneros.estadias)}</td>
                                        <td className="text-end">{formatearMoneda(totalesCamioneros.combustible)}</td>
                                        <td className="text-end">{formatearMoneda(totalesCamioneros.neto)}</td>
                                        <td className="text-end">{formatearNumero(rentabilidadTotalCamioneros)}%</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>

            <div className="card shadow-sm finanzas-section-card">
                <div className="card-header bg-transparent border-0 pt-3">
                    <h5 className="mb-0 d-flex align-items-center gap-2"><i className="bi bi-people-fill" /> Facturación Por Cliente</h5>
                    <div className="small text-body-secondary">Control de ingresos cobrados y pendientes por cliente</div>
                </div>
                <div className="card-body p-0">
                    <div className="table-responsive">
                        <table className="table table-hover table-striped align-middle mb-0 finanzas-mobile-card-table">
                            <thead>
                                <tr>
                                    <th>Cliente</th>
                                    <th className="text-end">Viajes</th>
                                    <th className="text-end">Total</th>
                                    <th className="text-end">Cobradas</th>
                                    <th className="text-end">Pendientes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {facturacionPorCliente.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="text-center py-4 text-body-secondary">No hay facturación para este mes.</td>
                                    </tr>
                                )}
                                {facturacionPorCliente.map((row) => (
                                    <tr key={row.cliente}>
                                        <td data-label="Cliente">{row.cliente}</td>
                                        <td className="text-end" data-label="Viajes">{row.viajes}</td>
                                        <td className="text-end fw-semibold" data-label="Total">{formatearMoneda(row.total)}</td>
                                        <td className="text-end text-success" data-label="Cobradas">{formatearMoneda(row.cobradas)}</td>
                                        <td className="text-end text-warning" data-label="Pendientes">{formatearMoneda(row.pendientes)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            {facturacionPorCliente.length > 0 && (
                                <tfoot>
                                    <tr className="fw-semibold">
                                        <td>Total</td>
                                        <td className="text-end">{formatearNumero(totalesClientes.viajes)}</td>
                                        <td className="text-end">{formatearMoneda(totalesClientes.total)}</td>
                                        <td className="text-end text-success">{formatearMoneda(totalesClientes.cobradas)}</td>
                                        <td className="text-end text-warning">{formatearMoneda(totalesClientes.pendientes)}</td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

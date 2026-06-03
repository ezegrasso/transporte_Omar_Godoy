import { useMemo } from 'react';
import { Bar, Line, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, ArcElement);

const currencyFormatter = new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
});

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CHOFER_COLORS = ['#2563eb', '#16a34a', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#db2777', '#0f766e', '#7c3aed', '#4f46e5'];
const FACTURA_LABELS = ['pendiente', 'emitida', 'cobrada', 'vencida'];
const FACTURA_COLORS = {
    pendiente: '#6b7280',
    emitida: '#f59e0b',
    cobrada: '#22c55e',
    vencida: '#ef4444',
};

const getChoferColor = (index) => {
    if (index < CHOFER_COLORS.length) return CHOFER_COLORS[index];
    const hue = (index * 47) % 360;
    return `hsl(${hue} 75% 48%)`;
};

export default function DashboardCharts({ viajes, filtros = {} }) {
    const { from, to, cliente, tipo, year } = filtros;
    const viajesBase = useMemo(() => (viajes || []), [viajes]);
    const finalizadosBase = useMemo(() => viajesBase.filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajesBase]);

    const finalizados = useMemo(() => {
        return finalizadosBase.filter(v => {
            const fechaOk = (() => {
                if (!from && !to) return true;
                const d = new Date(v.fecha);
                const fOk = from ? d >= new Date(from) : true;
                const tOk = to ? d <= new Date(to) : true;
                return fOk && tOk;
            })();
            const clienteOk = cliente ? (v.cliente || '') === cliente : true;
            const tipoOk = tipo ? (v.tipoMercaderia || '') === tipo : true;
            const yearOk = year ? String(v.fecha || '').slice(0, 4) === String(year) : true;
            return fechaOk && clienteOk && tipoOk && yearOk;
        });
    }, [finalizadosBase, from, to, cliente, tipo, year]);

    const porCliente = useMemo(() => {
        const map = new Map();
        finalizados.forEach(v => {
            const key = v.cliente || 'Sin cliente';
            const imp = Number(v.importe || 0);
            map.set(key, (map.get(key) || 0) + (isNaN(imp) ? 0 : imp));
        });
        const labels = Array.from(map.keys());
        const data = Array.from(map.values());
        return { labels, data };
    }, [finalizados]);

    const porEstadoFactura = useMemo(() => {
        const map = new Map(FACTURA_LABELS.map(label => [label, 0]));
        viajesBase.forEach(v => {
            const rawEstado = String(v.facturaEstado || '').toLowerCase().trim();
            const tieneFacturaCargada = !!(v.facturaUrl || v.fechaFactura || v.precioUnitarioFactura || v.precioUnitarioNegro);

            let est = 'pendiente';
            if (rawEstado === 'cobrada' || rawEstado === 'cobrado') {
                est = 'cobrada';
            } else if (rawEstado === 'vencida') {
                est = 'vencida';
            } else if (rawEstado === 'emitida' || rawEstado === 'no cobrada' || tieneFacturaCargada) {
                est = 'emitida';
            }

            map.set(est, (map.get(est) || 0) + 1);
        });
        const labels = FACTURA_LABELS.filter(label => (map.get(label) || 0) > 0);
        const data = labels.map(label => map.get(label) || 0);
        return { labels, data };
    }, [viajesBase]);

    return (
        <div className="row g-3">
            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2 bg-body-tertiary d-flex align-items-center justify-content-between">
                        <div>
                            <div className="fw-semibold">Importe total por cliente</div>
                            <small className="text-body-secondary">Acumulado según los filtros seleccionados</small>
                        </div>
                    </div>
                    <div className="card-body" style={{ height: 280 }}>
                        <Bar
                            data={{
                                labels: porCliente.labels,
                                datasets: [{
                                    label: 'Importe',
                                    data: porCliente.data,
                                    backgroundColor: 'rgba(13,110,253,0.78)',
                                    borderRadius: 10,
                                    maxBarThickness: 56,
                                }],
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        grid: { color: 'rgba(0,0,0,0.06)' },
                                        ticks: { callback: (value) => currencyFormatter.format(value) },
                                    },
                                    x: { grid: { display: false } },
                                },
                            }}
                        />
                    </div>
                </div>
            </div>

            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2 bg-body-tertiary d-flex align-items-center justify-content-between">
                        <div>
                            <div className="fw-semibold">Estado de facturas</div>
                            <small className="text-body-secondary">Distribución de viajes finalizados</small>
                        </div>
                    </div>
                    <div className="card-body" style={{ height: 280 }}>
                        <Doughnut
                            data={{
                                labels: porEstadoFactura.labels,
                                datasets: [{
                                    data: porEstadoFactura.data,
                                    backgroundColor: porEstadoFactura.labels.map(label => FACTURA_COLORS[label] || '#6b7280'),
                                    borderWidth: 0,
                                    hoverOffset: 6,
                                }],
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                cutout: '62%',
                                plugins: {
                                    legend: {
                                        position: 'bottom',
                                        labels: { usePointStyle: true, boxWidth: 10, boxHeight: 10 },
                                    },
                                },
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function FacturacionAnualPorChoferChart({ viajes, year, selectedChoferes = [] }) {
    const finalizadosBase = useMemo(() => (viajes || []).filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajes]);

    const choferesSeleccionados = useMemo(() => {
        return Array.isArray(selectedChoferes)
            ? selectedChoferes.map(c => String(c || '').trim()).filter(Boolean)
            : [];
    }, [selectedChoferes]);

    const facturacionAnualPorChofer = useMemo(() => {
        const selectedYear = String(year || new Date().getFullYear());
        const byChofer = new Map();

        finalizadosBase.forEach(v => {
            const fecha = String(v.fecha || '');
            if (fecha.slice(0, 4) !== selectedYear) return;

            const chofer = (v.camionero?.nombre || v.camioneroNombre || 'Sin chofer').trim();
            if (choferesSeleccionados.length > 0 && !choferesSeleccionados.includes(chofer)) return;

            if (!byChofer.has(chofer)) byChofer.set(chofer, Array(12).fill(0));

            const monthIndex = Number(fecha.slice(5, 7)) - 1;
            if (monthIndex < 0 || monthIndex > 11) return;

            const imp = Number(v.importe || 0);
            byChofer.get(chofer)[monthIndex] += isNaN(imp) ? 0 : imp;
        });

        const series = Array.from(byChofer.entries())
            .map(([nombre, data]) => ({
                nombre,
                data,
                total: data.reduce((sum, value) => sum + value, 0),
            }))
            .sort((a, b) => b.total - a.total);

        return {
            labels: MONTH_LABELS,
            datasets: series.map((serie, index) => {
                const color = getChoferColor(index);
                return {
                    label: serie.nombre,
                    data: serie.data,
                    borderColor: color,
                    backgroundColor: `${color}22`,
                    pointBackgroundColor: color,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    tension: 0.35,
                    fill: false,
                };
            }),
        };
    }, [finalizadosBase, year, choferesSeleccionados]);

    const explicitlyProvidedArray = Array.isArray(selectedChoferes);

    if (explicitlyProvidedArray && choferesSeleccionados.length === 0) {
        return (
            <div className="col-12">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2 bg-body-tertiary d-flex align-items-center justify-content-between">
                        <div>
                            <div className="fw-semibold">Facturación anual por chofer</div>
                            <small className="text-body-secondary">Ningún chofer seleccionado</small>
                        </div>
                    </div>
                    <div className="card-body" style={{ height: 360 }}>
                        <div className="h-100 d-flex align-items-center justify-content-center text-body-secondary">
                            No hay choferes seleccionados — seleccioná alguno para ver la facturación.
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const choferMessage = choferesSeleccionados.length > 0
        ? choferesSeleccionados.length === 1
            ? `Mostrando la evolución anual de ${choferesSeleccionados[0]}`
            : `Mostrando la evolución anual de ${choferesSeleccionados.length} choferes`
        : 'Mostrando la evolución anual de todos los choferes';

    return (
        <div className="col-12">
            <div className="card shadow-sm h-100">
                <div className="card-header py-2 bg-body-tertiary d-flex align-items-center justify-content-between">
                    <div>
                        <div className="fw-semibold">Facturación anual por chofer</div>
                        <small className="text-body-secondary">{choferMessage}</small>
                    </div>
                </div>
                <div className="card-body" style={{ height: 360 }}>
                    {facturacionAnualPorChofer.datasets.length === 0 ? (
                        <div className="h-100 d-flex align-items-center justify-content-center text-body-secondary">
                            No hay viajes finalizados para mostrar con el filtro actual.
                        </div>
                    ) : (
                        <Line
                            data={{
                                labels: facturacionAnualPorChofer.labels,
                                datasets: facturacionAnualPorChofer.datasets,
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                interaction: { mode: 'index', intersect: false },
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        align: 'start',
                                        labels: { usePointStyle: true, boxWidth: 10, boxHeight: 10, padding: 18 },
                                    },
                                    tooltip: {
                                        callbacks: {
                                            label: (ctx) => `${ctx.dataset.label}: ${currencyFormatter.format(ctx.parsed.y || 0)}`,
                                        },
                                    },
                                },
                                scales: {
                                    y: {
                                        beginAtZero: true,
                                        grid: { color: 'rgba(0,0,0,0.06)' },
                                        ticks: { callback: (value) => currencyFormatter.format(value) },
                                    },
                                    x: { grid: { display: false } },
                                },
                            }}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

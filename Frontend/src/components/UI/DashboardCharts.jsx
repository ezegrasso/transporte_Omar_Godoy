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

export default function DashboardCharts({ viajes, filtros = {} }) {
    const { from, to, cliente, tipo } = filtros;
    const finalizadosBase = useMemo(() => (viajes || []).filter(v => (v.estado || '').toLowerCase() === 'finalizado'), [viajes]);
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
            return fechaOk && clienteOk && tipoOk;
        });
    }, [finalizadosBase, from, to, cliente, tipo]);

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

    const kilosPorDia = useMemo(() => {
        const map = new Map();
        finalizados.forEach(v => {
            const f = (v.fecha || '').slice(0, 10);
            const k = Number(v.kilosCargados || 0);
            map.set(f, (map.get(f) || 0) + (isNaN(k) ? 0 : k));
        });
        const labels = Array.from(map.keys()).sort();
        const data = labels.map(l => map.get(l));
        return { labels, data };
    }, [finalizados]);

    const porEstadoFactura = useMemo(() => {
        const map = new Map();
        finalizados.forEach(v => {
            const est = (v.facturaEstado || 'pendiente').toLowerCase();
            map.set(est, (map.get(est) || 0) + 1);
        });
        const labels = Array.from(map.keys());
        const data = Array.from(map.values());
        return { labels, data };
    }, [finalizados]);

    // Extra: barras por tipo de mercadería y destino (top 5 por importe)
    const porTipoMercaderiaYCliente = useMemo(() => {
        const tipos = new Set();
        const clientes = new Set();
        finalizados.forEach(v => { tipos.add(v.tipoMercaderia || 'General'); clientes.add(v.cliente || 'Sin cliente'); });
        const types = Array.from(tipos);
        const clis = Array.from(clientes);
        const matrix = types.map(() => clis.map(() => 0));
        finalizados.forEach(v => {
            const ti = types.indexOf(v.tipoMercaderia || 'General');
            const ci = clis.indexOf(v.cliente || 'Sin cliente');
            const imp = Number(v.importe || 0);
            if (ti >= 0 && ci >= 0) matrix[ti][ci] += isNaN(imp) ? 0 : imp;
        });
        const datasets = types.map((t, i) => ({ label: t, data: matrix[i], backgroundColor: `hsl(${(i * 70) % 360} 70% 55%)` }));
        return { labels: clis, datasets };
    }, [finalizados]);

    const topDestinosPorImporte = useMemo(() => {
        const map = new Map();
        finalizados.forEach(v => {
            const dest = v.destino || 'Sin destino';
            const imp = Number(v.importe || 0);
            map.set(dest, (map.get(dest) || 0) + (isNaN(imp) ? 0 : imp));
        });
        const pairs = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        return { labels: pairs.map(p => p[0]), data: pairs.map(p => p[1]) };
    }, [finalizados]);

    return (
        <div className="row g-3">
            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2">Importe total por cliente</div>
                    <div className="card-body" style={{ height: 260 }}>
                        <Bar
                            data={{
                                labels: porCliente.labels,
                                datasets: [{ label: 'Importe', data: porCliente.data, backgroundColor: 'rgba(13,110,253,0.6)' }],
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }}
                        />
                    </div>
                </div>
            </div>

            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2">Kilos cargados por día</div>
                    <div className="card-body" style={{ height: 260 }}>
                        <Line
                            data={{
                                labels: kilosPorDia.labels,
                                datasets: [{ label: 'Kilos', data: kilosPorDia.data, borderColor: '#198754', backgroundColor: 'rgba(25,135,84,0.15)' }],
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }}
                        />
                    </div>
                </div>
            </div>

            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2">Estado de facturas</div>
                    <div className="card-body" style={{ height: 260 }}>
                        <Doughnut
                            data={{
                                labels: porEstadoFactura.labels,
                                datasets: [{ data: porEstadoFactura.data, backgroundColor: ['#6c757d', '#0dcaf0', '#198754', '#ffc107'] }],
                            }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
                        />
                    </div>
                </div>
            </div>

            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2">Importe por tipo y cliente</div>
                    <div className="card-body" style={{ height: 260 }}>
                        <Bar
                            data={{ labels: porTipoMercaderiaYCliente.labels, datasets: porTipoMercaderiaYCliente.datasets }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { stacked: true, grid: { display: false } } } }}
                        />
                    </div>
                </div>
            </div>

            <div className="col-12 col-lg-6">
                <div className="card shadow-sm h-100">
                    <div className="card-header py-2">Top 5 destinos por importe</div>
                    <div className="card-body" style={{ height: 260 }}>
                        <Bar
                            data={{ labels: topDestinosPorImporte.labels, datasets: [{ label: 'Importe', data: topDestinosPorImporte.data, backgroundColor: '#6610f2' }] }}
                            options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}

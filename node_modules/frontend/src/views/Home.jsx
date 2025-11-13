import { useEffect, useState } from 'react'
import PageHeader from '../components/UI/PageHeader'
import { Link } from 'react-router-dom'
import StatCard from '../components/UI/StatCard'
import EmptyState from '../components/UI/EmptyState'
import { SkeletonText } from '../components/UI/Skeleton'
import api from '../services/api'

export default function Home() {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [stats, setStats] = useState({ viajes: 0, enCurso: 0, finalizados: 0 })
    const [recent, setRecent] = useState([])

    useEffect(() => {
        (async () => {
            setLoading(true); setError('')
            try {
                const [viajesRes] = await Promise.all([
                    api.get('/api/viajes?limit=10')
                ])
                const items = viajesRes.data.items || viajesRes.data.data || []
                const total = items.length
                const enCurso = items.filter(v => v.estado === 'en curso').length
                const finalizados = items.filter(v => v.estado === 'finalizado').length
                setStats({ viajes: total, enCurso, finalizados })
                setRecent(items.slice(0, 5))
            } catch (e) {
                setError(e?.response?.data?.error || 'No se pudo cargar el panel')
            } finally { setLoading(false) }
        })()
    }, [])

    return (
        <div className="container py-3">
            <PageHeader
                title="Panel general"
                subtitle="Resumen rápido y accesos directos"
                actions={<Link className="btn btn-primary" to="/admin">Ir a Admin</Link>}
            />

            <div className="row g-3">
                <div className="col-sm-6 col-lg-4">
                    {loading ? (
                        <div className="card shadow-sm p-3"><SkeletonText lines={3} /></div>
                    ) : (
                        <StatCard icon={<i className="bi bi-truck" />} label="Viajes" value={stats.viajes} hint="Totales recientes" />
                    )}
                </div>
                <div className="col-sm-6 col-lg-4">
                    {loading ? (
                        <div className="card shadow-sm p-3"><SkeletonText lines={3} /></div>
                    ) : (
                        <StatCard icon={<i className="bi bi-clock-history" />} label="En curso" value={stats.enCurso} />
                    )}
                </div>
                <div className="col-sm-6 col-lg-4">
                    {loading ? (
                        <div className="card shadow-sm p-3"><SkeletonText lines={3} /></div>
                    ) : (
                        <StatCard icon={<i className="bi bi-flag" />} label="Finalizados" value={stats.finalizados} />
                    )}
                </div>
            </div>

            <div className="card shadow-sm mt-3">
                <div className="card-body">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                        <h5 className="mb-0">Últimos viajes</h5>
                        <Link to="/camionero" className="btn btn-sm btn-outline-secondary">Ver más</Link>
                    </div>
                    {error && <div className="alert alert-danger mb-2">{error}</div>}
                    {loading ? (
                        <SkeletonText lines={4} />
                    ) : recent.length === 0 ? (
                        <EmptyState title="Sin datos" description="No hay viajes recientes" />
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-sm table-striped align-middle mb-0">
                                <thead>
                                    <tr><th>Fecha</th><th>Origen</th><th>Destino</th><th>Estado</th></tr>
                                </thead>
                                <tbody>
                                    {recent.map(v => (
                                        <tr key={v.id}>
                                            <td>{new Date(v.fecha).toLocaleDateString()}</td>
                                            <td>{v.origen}</td>
                                            <td>{v.destino}</td>
                                            <td>
                                                <span className={`badge ${v.estado === 'finalizado'
                                                    ? 'badge-estado-finalizado'
                                                    : v.estado === 'en curso'
                                                        ? 'badge-estado-en_curso'
                                                        : 'badge-estado-pendiente'
                                                    } text-capitalize`}>{v.estado}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

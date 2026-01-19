import { useEffect, useState } from 'react'
import PageHeader from '../components/UI/PageHeader'
import { Link } from 'react-router-dom'
import StatCard from '../components/UI/StatCard'
import EmptyState from '../components/UI/EmptyState'
import { SkeletonText } from '../components/UI/Skeleton'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function Home() {
    const { user } = useAuth()
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [stats, setStats] = useState({ viajes: 0, enCurso: 0, finalizados: 0 })
    const [recent, setRecent] = useState([])

    // Helper fecha (DATEONLY -> local)
    const formatDateOnly = (s) => {
        if (!s) return '-'
        try { const [y, m, d] = String(s).split('-').map(Number); const dt = new Date(y, (m || 1) - 1, d || 1); return dt.toLocaleDateString(); } catch { return s; }
    }

    useEffect(() => {
        (async () => {
            setLoading(true); setError('')
            try {
                const [viajesRes] = await Promise.all([
                    api.get('/viajes?limit=10')
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
            <div className="home-hero mb-3">
                <PageHeader
                    title="Panel general"
                    subtitle={user ? `Bienvenido, ${user.nombre}` : "Resumen rápido del día"}
                />

                {/* Accesos rápidos según rol */}
                {user && (
                    <div className="row g-3 mb-4">
                        {user.rol === 'ceo' && (
                            <>
                                <div className="col-sm-6 col-lg-4">
                                    <Link to="/ceo" className="text-decoration-none">
                                        <div className="card shadow-sm h-100 card-hover">
                                            <div className="card-body text-center py-4">
                                                <i className="bi bi-speedometer2 text-primary" style={{ fontSize: '3rem' }}></i>
                                                <h5 className="mt-3 mb-1">Panel CEO</h5>
                                                <p className="text-body-secondary small mb-0">Gestión completa</p>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                                <div className="col-sm-6 col-lg-4">
                                    <Link to="/administracion" className="text-decoration-none">
                                        <div className="card shadow-sm h-100 card-hover">
                                            <div className="card-body text-center py-4">
                                                <i className="bi bi-receipt text-success" style={{ fontSize: '3rem' }}></i>
                                                <h5 className="mt-3 mb-1">Administración</h5>
                                                <p className="text-body-secondary small mb-0">Facturas y reportes</p>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            </>
                        )}
                        {user.rol === 'administracion' && (
                            <div className="col-sm-6 col-lg-4">
                                <Link to="/administracion" className="text-decoration-none">
                                    <div className="card shadow-sm h-100 card-hover">
                                        <div className="card-body text-center py-4">
                                            <i className="bi bi-receipt text-success" style={{ fontSize: '3rem' }}></i>
                                            <h5 className="mt-3 mb-1">Panel Administración</h5>
                                            <p className="text-body-secondary small mb-0">Facturas y reportes</p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        )}
                        {user.rol === 'camionero' && (
                            <div className="col-sm-6 col-lg-4">
                                <Link to="/camionero" className="text-decoration-none">
                                    <div className="card shadow-sm h-100 card-hover">
                                        <div className="card-body text-center py-4">
                                            <i className="bi bi-truck text-primary" style={{ fontSize: '3rem' }}></i>
                                            <h5 className="mt-3 mb-1">Mis Viajes</h5>
                                            <p className="text-body-secondary small mb-0">Ver y gestionar viajes</p>
                                        </div>
                                    </div>
                                </Link>
                            </div>
                        )}
                    </div>
                )}

                <div className="row g-3">
                    <div className="col-sm-6 col-lg-4">
                        {loading ? (
                            <div className="card shadow-sm p-3"><SkeletonText lines={3} /></div>
                        ) : (
                            <StatCard icon={<i className="bi bi-truck text-primary" />} label="Viajes" value={stats.viajes} hint="Totales recientes" />
                        )}
                    </div>
                    <div className="col-sm-6 col-lg-4">
                        {loading ? (
                            <div className="card shadow-sm p-3"><SkeletonText lines={3} /></div>
                        ) : (
                            <StatCard icon={<i className="bi bi-clock-history text-warning" />} label="En curso" value={stats.enCurso} />
                        )}
                    </div>
                    <div className="col-sm-6 col-lg-4">
                        {loading ? (
                            <div className="card shadow-sm p-3"><SkeletonText lines={3} /></div>
                        ) : (
                            <StatCard icon={<i className="bi bi-flag text-success" />} label="Finalizados" value={stats.finalizados} />
                        )}
                    </div>
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
                                            <td>{formatDateOnly(v.fecha)}</td>
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

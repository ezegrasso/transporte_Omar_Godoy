import { useEffect, useMemo, useState } from 'react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

const ITEMS = [
    { key: 'carnet', label: 'Carnet' },
    { key: 'curso_profesional', label: 'Curso Profesional' },
    { key: 'psicofisico', label: 'Psicofisico' },
]

const NOTIF_CONFIG = {
    vencimiento: { icon: 'bi-calendar-event', bg: 'bg-warning-subtle', dot: 'bg-warning' },
    viaje_tomado: { icon: 'bi-truck', bg: 'bg-primary-subtle', dot: 'bg-primary' },
    factura_vencida: { icon: 'bi-exclamation-triangle', bg: 'bg-danger-subtle', dot: 'bg-danger' },
    por_defecto: { icon: 'bi-bell', bg: 'bg-secondary-subtle', dot: 'bg-secondary' },
}

const getCfg = (tipo) => NOTIF_CONFIG[tipo] || NOTIF_CONFIG.por_defecto

const relTime = (value) => {
    try {
        const date = new Date(value)
        if (Number.isNaN(date.getTime())) return ''
        const diff = Math.floor((Date.now() - date.getTime()) / 1000)
        if (diff < 60) return 'hace unos segundos'
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
        return `hace ${Math.floor(diff / 86400)} d`
    } catch {
        return ''
    }
}

export default function CamioneroAlertasYVencimientos() {
    const { showToast } = useToast()
    const [vencimientos, setVencimientos] = useState([])
    const [loadingVencimientos, setLoadingVencimientos] = useState(false)

    const fetchVencimientos = async () => {
        try {
            setLoadingVencimientos(true)
            const { data } = await api.get('/vencimientos/mios')
            setVencimientos(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error('Error cargando vencimientos:', e)
            setVencimientos([])
        } finally {
            setLoadingVencimientos(false)
        }
    }

    useEffect(() => { fetchVencimientos() }, [])
    const handleSave = async (id, patch) => {
        try {
            const { data } = await api.put(`/vencimientos/mios/${id}`, patch)
            setVencimientos((prev) => prev.map((row) => (row.id === id ? data : row)))
            showToast('Vencimiento guardado', 'success')
        } catch (e) {
            console.error(e)
            showToast('No se pudo guardar el vencimiento', 'error')
        }
    }

    return (
        <>
            {/* Notificaciones removidas de aquí; usar NotificationBell en el header */}

            <div className="card shadow-sm border-warning mb-3">
                <div className="card-header bg-warning bg-opacity-10 d-flex align-items-center gap-2 py-2">
                    <i className="bi bi-calendar-check text-warning" style={{ fontSize: '1.25rem' }}></i>
                    <h6 className="mb-0 fw-bold">Mis vencimientos</h6>
                    <div className="ms-auto">
                        <span className="badge text-bg-warning text-dark">Carnet · Curso Profesional · Psicofisico</span>
                    </div>
                </div>
                <div className="card-body">
                    {loadingVencimientos ? (
                        <div className="text-center py-4">
                            <span className="spinner-border spinner-border-sm text-secondary" role="status" />
                            <div className="text-muted small mt-2">Cargando vencimientos...</div>
                        </div>
                    ) : (
                        <div className="table-responsive">
                            <table className="table table-sm align-middle mb-0">
                                <thead className="table-light">
                                    <tr>
                                        <th>Documento</th>
                                        <th>Desde</th>
                                        <th>Hasta</th>
                                        <th>Observaciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ITEMS.map((item) => {
                                        const row = vencimientos.find((v) => v.item === item.key)
                                        return (
                                            <tr key={item.key}>
                                                <td className="fw-semibold">{item.label}</td>
                                                <td style={{ minWidth: 160 }}>
                                                    <input
                                                        type="date"
                                                        className="form-control form-control-sm"
                                                        defaultValue={row?.fechaDesde || ''}
                                                        onBlur={(e) => {
                                                            if (!row) return
                                                            handleSave(row.id, { fechaDesde: e.target.value || null })
                                                        }}
                                                    />
                                                </td>
                                                <td style={{ minWidth: 160 }}>
                                                    <input
                                                        type="date"
                                                        className="form-control form-control-sm"
                                                        defaultValue={row?.fechaHasta || ''}
                                                        onBlur={(e) => {
                                                            if (!row) return
                                                            handleSave(row.id, { fechaHasta: e.target.value || null })
                                                        }}
                                                    />
                                                </td>
                                                <td>
                                                    <input
                                                        className="form-control form-control-sm"
                                                        defaultValue={row?.observaciones || ''}
                                                        onBlur={(e) => {
                                                            if (!row) return
                                                            handleSave(row.id, { observaciones: e.target.value || null })
                                                        }}
                                                        placeholder="Observaciones"
                                                    />
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </>
    )
}
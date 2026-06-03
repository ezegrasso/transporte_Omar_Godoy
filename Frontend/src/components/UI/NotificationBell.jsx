import { useEffect, useRef, useState, useMemo } from 'react'
import api from '../../services/api'
import { useToast } from '../../context/ToastContext'

export default function NotificationBell() {
    const { showToast } = useToast()
    const [notis, setNotis] = useState([])
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [pulse, setPulse] = useState(false)
    const [prevUnread, setPrevUnread] = useState(0)
    const panelRef = useRef(null)
    const btnRef = useRef(null)

    const unread = useMemo(() => (notis || []).filter(n => !n.leida).length, [notis])

    const formatMessage = (noti) => {
        const raw = String(noti?.mensaje || '')
        const match = raw.match(/(?:camion|camión)\s+([A-Z0-9-]+)/i)
        const patente = match?.[1] || ''
        const texto = raw
            .replace(/^Vencimiento\s+/i, 'Se registró el vencimiento de ')
            .replace(/\s+vencido el\s+/i, ' con fecha ')
        return patente ? `${texto} Patente: ${patente}.` : texto
    }

    const fetchNotis = async () => {
        try {
            setLoading(true)
            const { data } = await api.get('/notificaciones/mias')
            const list = Array.isArray(data) ? data : (data?.items || [])
            setNotis(list)
            const newUnread = (list || []).filter(n => !n.leida).length
            if (newUnread > prevUnread) {
                setPulse(true)
                setTimeout(() => setPulse(false), 1200)
                if (!open) setOpen(true)
            }
            setPrevUnread(newUnread)
        } catch {
            // noop
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchNotis()
        const t = setInterval(fetchNotis, 60000)
        return () => clearInterval(t)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (!open) return
        const onPointer = (e) => {
            const panel = panelRef.current
            const btn = btnRef.current
            const target = e.target
            if (!target) return
            if (panel && panel.contains(target)) return
            if (btn && btn.contains(target)) return
            setOpen(false)
        }
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
        document.addEventListener('pointerdown', onPointer, true)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('pointerdown', onPointer, true)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    return (
        <div className="d-inline-block position-relative me-2">
            <button
                ref={btnRef}
                className={`btn btn-outline-secondary position-relative ${pulse ? 'notif-pulse' : ''}`}
                onClick={() => { setOpen(v => !v); if (!open) fetchNotis() }}
                disabled={loading}
                title="Notificaciones"
            >
                <i className="bi bi-bell"></i>
                {unread > 0 && <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">{unread}</span>}
            </button>
            {open && (
                <div ref={panelRef} className="card position-absolute end-0 mt-2 shadow og-notif-panel" style={{ minWidth: 420, zIndex: 1000 }}>
                    <div className="card-header d-flex align-items-center py-2 gap-2 og-notif-header">
                        <div>
                            <strong className="d-block">Notificaciones</strong>
                            <span className="small text-body-secondary">Vencimientos y avisos del sistema</span>
                        </div>
                        <span className={`badge rounded-pill ${unread > 0 ? 'text-bg-danger' : 'text-bg-secondary'} ms-1`}>{unread} sin leer</span>
                        <div className="ms-auto d-flex gap-1">
                            <button className="btn btn-sm btn-soft-warning" title="Refrescar" onClick={fetchNotis}><i className="bi bi-arrow-clockwise me-1"></i> Refrescar</button>
                        </div>
                    </div>
                    <div className="list-group list-group-flush og-notif-list" style={{ maxHeight: 320, overflowY: 'auto' }}>
                        {(notis || []).length === 0 ? (
                            <div className="text-center text-body-secondary p-3">Sin notificaciones</div>
                        ) : (
                            (notis || []).map(n => (
                                <div key={n.id} className={`list-group-item d-flex align-items-start gap-2 og-notif-item ${n.leida ? 'is-read' : 'is-unread'}`}>
                                    <div className={`rounded-circle d-flex align-items-center justify-content-center bg-secondary-subtle`} style={{ width: 36, height: 36, position: 'relative' }}>
                                        <i className={`bi bi-bell`}></i>
                                        {!n.leida && <span className={`position-absolute top-0 end-0 translate-middle p-1 border border-light rounded-circle bg-secondary`}></span>}
                                    </div>
                                    <div className="flex-grow-1 og-notif-content">
                                        <div className="d-flex align-items-center gap-2 mb-1 og-notif-meta">
                                            <span className="badge og-chip text-capitalize">{String(n.tipo || '').replaceAll('_', ' ')}</span>
                                            {!n.leida && <span className="badge og-chip og-chip-new">Nuevo</span>}
                                        </div>
                                        <div className="text-body-secondary small og-notif-time">{new Date(n.fecha).toLocaleString()}</div>
                                        <div className="small og-notif-message">{formatMessage(n)}</div>
                                    </div>
                                    <div className="d-flex flex-column gap-1 align-items-end og-notif-actions" aria-label="Acciones">
                                        {!n.leida && (
                                            <button className="btn btn-sm og-action-btn og-action-read" title="Marcar como leída" onClick={async () => {
                                                await api.patch(`/notificaciones/${n.id}/leida`)
                                                setNotis(prev => prev.map(x => x.id === n.id ? { ...x, leida: true } : x))
                                            }}>
                                                <i className="bi bi-check2"></i>
                                            </button>
                                        )}
                                        <button className="btn btn-sm og-action-btn og-action-delete" title="Eliminar esta notificación" onClick={async () => {
                                            if (!confirm('¿Eliminar esta notificación?')) return
                                            try {
                                                await api.delete(`/notificaciones/${n.id}`)
                                                setNotis(prev => prev.filter(x => x.id !== n.id))
                                            } catch {
                                                showToast('No se pudo eliminar la notificación', 'error')
                                            }
                                        }}>
                                            <i className="bi bi-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}

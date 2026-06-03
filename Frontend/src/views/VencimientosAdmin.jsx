import { useEffect, useState } from 'react'
import api from '../services/api'

const ITEM_TYPES = ['tecnica', 'seguro', 'senasa']

export default function VencimientosAdmin() {
    const [camiones, setCamiones] = useState([])
    const [acoplados, setAcoplados] = useState([])
    const [tipo, setTipo] = useState('camion')
    const [objetoId, setObjetoId] = useState('')
    const [vencimientos, setVencimientos] = useState([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        api.get('/camiones').then(r => {
            const payload = r?.data
            if (Array.isArray(payload)) return setCamiones(payload)
            if (payload && Array.isArray(payload.data)) return setCamiones(payload.data)
            if (payload && Array.isArray(payload.rows)) return setCamiones(payload.rows)
            return setCamiones([])
        }).catch(() => setCamiones([]))

        api.get('/acoplados').then(r => {
            const payload = r?.data
            if (Array.isArray(payload)) return setAcoplados(payload)
            if (payload && Array.isArray(payload.data)) return setAcoplados(payload.data)
            if (payload && Array.isArray(payload.rows)) return setAcoplados(payload.rows)
            return setAcoplados([])
        }).catch(() => setAcoplados([]))
    }, [])

    useEffect(() => {
        if (!objetoId) return setVencimientos([])
        const q = `/vencimientos?tipo=${tipo}&id=${objetoId}`
        setLoading(true)
        api.get(q).then(r => setVencimientos(r.data || [])).catch(() => setVencimientos([])).finally(() => setLoading(false))
    }, [tipo, objetoId])

    const handleCreate = async (item) => {
        try {
            const body = { tipoObjeto: tipo, objetoId: Number(objetoId), item, fechaDesde: null, fechaHasta: null, observaciones: '' }
            const r = await api.post('/vencimientos', body)
            setVencimientos(prev => [...prev, r.data])
        } catch (e) { console.error(e) }
    }

    const handleSave = async (id, patch) => {
        try {
            const r = await api.put(`/vencimientos/${id}`, patch)
            setVencimientos(prev => prev.map(p => p.id === id ? r.data : p))
        } catch (e) { console.error(e) }
    }

    const handleDelete = async (id) => {
        try {
            await api.delete(`/vencimientos/${id}`)
            setVencimientos(prev => prev.filter(p => p.id !== id))
        } catch (e) { console.error(e) }
    }

    return (
        <div>
            <h2>Vencimientos</h2>
            <div className="row mb-3">
                <div className="col-md-3">
                    <label>Tipo</label>
                    <select className="form-select" value={tipo} onChange={e => { setTipo(e.target.value); setObjetoId('') }}>
                        <option value="camion">Chasis</option>
                        <option value="acoplado">Acoplado</option>
                    </select>
                </div>
                <div className="col-md-6">
                    <label>Unidad</label>
                    <select className="form-select" value={objetoId} onChange={e => setObjetoId(e.target.value || '')}>
                        <option value="">-- Seleccionar --</option>
                        {tipo === 'camion' && camiones.map(c => <option key={c.id} value={String(c.id)}>{c.patente || c.modelo || c.id}</option>)}
                        {tipo === 'acoplado' && acoplados.map(a => <option key={a.id} value={String(a.id)}>{a.patente || a.id}</option>)}
                    </select>
                </div>
            </div>

            {!objetoId && <div className="text-muted">Selecciona una unidad para ver/editar vencimientos.</div>}

            {objetoId && (
                <div>
                    <table className="table table-sm">
                        <thead>
                            <tr><th>Item</th><th>Desde</th><th>Hasta</th><th>Observaciones</th></tr>
                        </thead>
                        <tbody>
                            {ITEM_TYPES.map(item => {
                                const row = vencimientos.find(v => v.item === item)
                                return (
                                    <tr key={item}>
                                        <td className="align-middle">{item.charAt(0).toUpperCase() + item.slice(1)}</td>
                                        <td>
                                            <input type="date" className="form-control form-control-sm" defaultValue={row?.fechaDesde || ''} onBlur={e => {
                                                if (!row) return
                                                handleSave(row.id, { fechaDesde: e.target.value || null })
                                            }} />
                                        </td>
                                        <td>
                                            <input type="date" className="form-control form-control-sm" defaultValue={row?.fechaHasta || ''} onBlur={e => {
                                                if (!row) return
                                                handleSave(row.id, { fechaHasta: e.target.value || null })
                                            }} />
                                        </td>
                                        <td>
                                            <input className="form-control form-control-sm" defaultValue={row?.observaciones || ''} onBlur={e => { if (!row) return; handleSave(row.id, { observaciones: e.target.value || null }) }} />
                                        </td>

                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

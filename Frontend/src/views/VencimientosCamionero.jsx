import PageHeader from '../components/UI/PageHeader'
import CamioneroAlertasYVencimientos from '../components/UI/CamioneroAlertasYVencimientos'

export default function VencimientosCamionero() {
    return (
        <div className="container py-3 space-y-4">
            <PageHeader title="Vencimientos" subtitle="Documentación y aptitudes" showUserMenu={true} />
            <CamioneroAlertasYVencimientos />
        </div>
    )
}

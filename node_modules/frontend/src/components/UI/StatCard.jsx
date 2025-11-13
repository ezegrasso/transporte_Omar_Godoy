export default function StatCard({ icon, label, value, hint }) {
    return (
        <div className="card shadow-sm h-100">
            <div className="card-body d-flex align-items-center gap-3">
                {icon && <div className="fs-3 text-primary">{icon}</div>}
                <div className="flex-grow-1">
                    <div className="text-body-secondary small text-uppercase fw-semibold">{label}</div>
                    <div className="fs-4 fw-bold">{value}</div>
                    {hint && <div className="small text-body-secondary">{hint}</div>}
                </div>
            </div>
        </div>
    );
}

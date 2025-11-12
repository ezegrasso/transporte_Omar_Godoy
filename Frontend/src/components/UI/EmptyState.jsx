export default function EmptyState({ icon, title, description, action }) {
    return (
        <div className="border rounded-3 p-4 text-center bg-body-tertiary">
            <div className="fs-1 mb-2 text-body-secondary">{icon || '📭'}</div>
            <h5 className="mb-1">{title}</h5>
            {description && <div className="text-body-secondary mb-3">{description}</div>}
            {action}
        </div>
    );
}

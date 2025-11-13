export function Skeleton({ height = 16, width = '100%', className = '' }) {
    return (
        <div
            className={`placeholder-wave ${className}`}
            style={{ display: 'inline-block', width, height, borderRadius: 8, background: 'var(--bs-secondary-bg-subtle)' }}
        >
            <span className="placeholder col-12" style={{ opacity: 0 }} />
        </div>
    );
}

export function SkeletonText({ lines = 3 }) {
    return (
        <div className="vstack gap-2">
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton key={i} height={14} width={`${80 - i * 10}%`} />
            ))}
        </div>
    );
}

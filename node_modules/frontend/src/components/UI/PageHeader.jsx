import UserMenu from '../../components/UserMenu';

export default function PageHeader({ title, subtitle, actions, children, showUserMenu = true }) {
    return (
        <div className="d-flex align-items-center justify-content-between mb-3 position-relative">
            <div className="me-3">
                <h2 className="mb-0">{title}</h2>
                {subtitle && <div className="text-body-secondary small mt-1">{subtitle}</div>}
                {children}
            </div>
            <div className="d-flex align-items-center gap-2 ms-auto">
                {actions}
                {showUserMenu && <UserMenu />}
            </div>
        </div>
    );
}

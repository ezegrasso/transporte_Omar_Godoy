import React from 'react';

export function Tooltip({ children, text, placement = 'top', show = false }) {
    return (
        <span className="position-relative d-inline-block">
            {children}
            {show && (
                <span
                    className={`tooltip bs-tooltip-${placement} fade show animate__animated animate__fadeIn animate__faster`}
                    role="tooltip"
                    style={{ position: 'absolute', zIndex: 9999, minWidth: 120, background: '#222', color: '#fff', padding: '6px 12px', borderRadius: 6, fontSize: 13, top: placement === 'top' ? '-36px' : 'auto', left: '50%', transform: 'translateX(-50%)' }}
                >
                    {text}
                </span>
            )}
        </span>
    );
}

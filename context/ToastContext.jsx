import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const idRef = useRef(0);

    const remove = useCallback((id) => {
        setToasts((list) => list.filter((t) => t.id !== id));
    }, []);

    const showToast = useCallback((message, type = 'info', duration = 3000) => {
        const id = ++idRef.current;
        setToasts((list) => [...list, { id, message, type }]);
        if (duration > 0) {
            setTimeout(() => remove(id), duration);
        }
    }, [remove]);

    const value = useMemo(() => ({ showToast }), [showToast]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <div className="toast-container">
                {toasts.map((t) => (
                    <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}

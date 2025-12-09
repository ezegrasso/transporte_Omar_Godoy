import React from 'react';

export function ConfirmModal({ show, title, message, onConfirm, onCancel }) {
    if (!show) return null;
    return (
        <div className="modal fade show" style={{ display: 'block', background: 'rgba(0,0,0,0.3)' }} tabIndex="-1" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-dialog-centered" role="document">
                <div className="modal-content animate__animated animate__fadeIn animate__faster">
                    <div className="modal-header">
                        <h5 className="modal-title">{title}</h5>
                        <button type="button" className="btn-close" aria-label="Cerrar" onClick={onCancel}></button>
                    </div>
                    <div className="modal-body">
                        <p>{message}</p>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-outline-secondary" onClick={onCancel}>Cancelar</button>
                        <button type="button" className="btn btn-danger" onClick={onConfirm}>Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    );
}

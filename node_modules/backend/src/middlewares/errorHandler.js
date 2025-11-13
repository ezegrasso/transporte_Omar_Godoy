export const errorHandler = (err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    let status = err.status || 500;
    let message = err.message || 'Error interno del servidor';

    if (err.name === 'SequelizeUniqueConstraintError') {
        status = 409;
        message = 'Recurso duplicado';
    } else if (err.name === 'SequelizeValidationError') {
        status = 400;
        message = err.errors?.map(e => e.message).join(', ') || 'Datos inválidos';
    }

    res.status(status).json({ error: message });
};

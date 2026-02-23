import axios from 'axios';

// Base URL del backend: usa VITE_API_BASE_URL si está definida; por defecto http://localhost:8080
const BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080').replace(/\/$/, '');

const api = axios.create({
    baseURL: `${BASE}/api`,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// Si el token es inválido/expiró, desloguear y mandar a /login
api.interceptors.response.use(
    (res) => res,
    (error) => {
        const status = error?.response?.status;
        if (status === 401) {
            try {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
            } catch { }
            if (typeof window !== 'undefined' && window.location?.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
// Función para descargar factura desde el servidor
export const downloadFactura = async (viajeId, facturaUrl) => {
    try {
        if (!facturaUrl) {
            throw new Error('URL de factura no disponible');
        }
        
        // Descargar directamente desde B2 (sin pasar por servidor)
        const a = document.createElement('a');
        a.href = facturaUrl;
        a.download = `factura_${viajeId}.pdf`;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        if (a.parentNode) {
            a.parentNode.removeChild(a);
        }
    } catch (error) {
        throw new Error(error?.message || 'Error al descargar la factura');
    }
};
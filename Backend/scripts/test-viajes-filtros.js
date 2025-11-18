#!/usr/bin/env node
// Test básico de filtros de viajes (requiere backend corriendo en PORT)
import dotenv from 'dotenv';
dotenv.config();
import axios from 'axios';

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const CEO_EMAIL = process.env.CEO_EMAIL || 'ceo@example.com';
const CEO_PASSWORD = process.env.CEO_PASSWORD || 'ceo123';

(async () => {
    const log = console.log;
    try {
        log('Iniciando pruebas de filtros de viajes...');

        // 1. Login CEO
        const loginRes = await axios.post(`${BASE}/api/auth/login`, { email: CEO_EMAIL, password: CEO_PASSWORD });
        const token = loginRes.data.token;
        log('Login CEO OK');
        const auth = { headers: { Authorization: `Bearer ${token}` } };

        // 2. Asegurar camion (crear uno con patente única)
        const unique = Date.now().toString().slice(-6);
        const camionPayload = { patente: `AA${unique.slice(0, 3)}${unique.slice(3, 6)}`.toUpperCase(), marca: 'Test', modelo: 'Modelo', anio: 2024 };
        let camionId;
        try {
            const camRes = await axios.post(`${BASE}/api/camiones`, camionPayload, auth);
            camionId = camRes.data.id;
            log('Camión creado:', camionPayload.patente);
        } catch (e) {
            throw new Error('No se pudo crear camión para pruebas: ' + (e.response?.data?.error || e.message));
        }

        // 3. Crear dos viajes en fechas distintas
        const hoy = new Date();
        const fecha1 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 2).toISOString().slice(0, 10); // hace 2 días
        const fecha2 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 2).toISOString().slice(0, 10); // dentro de 2 días

        const crearViaje = async (fecha, origen) => {
            const body = { origen, destino: 'DestinoX', fecha, camionId };
            const res = await axios.post(`${BASE}/api/viajes`, body, auth);
            return res.data.id;
        };

        const v1 = await crearViaje(fecha1, 'OrigenPasado');
        const v2 = await crearViaje(fecha2, 'OrigenFuturo');
        log('Viajes creados:', v1, v2);

        // 4. Query con rango que solo incluya v1
        const from = fecha1;
        const to = fecha1; // mismo día
        const q1 = await axios.get(`${BASE}/api/viajes?limit=100&from=${from}&to=${to}&order=DESC&sortBy=fecha`, auth);
        const dataRango1 = q1.data.data || q1.data.items || [];
        const idsRango1 = dataRango1.map(v => v.id);
        if (!idsRango1.includes(v1) || idsRango1.includes(v2)) {
            throw new Error(`Fallo filtro (rango1). Esperado solo ${v1}, obtenido: ${idsRango1.join(',')}`);
        }
        log('Filtro por rango día único OK');

        // 5. Query que incluya ambos
        const from2 = fecha1;
        const to2 = fecha2;
        const q2 = await axios.get(`${BASE}/api/viajes?limit=100&from=${from2}&to=${to2}&order=DESC&sortBy=fecha`, auth);
        const dataRango2 = q2.data.data || q2.data.items || [];
        const idsRango2 = dataRango2.map(v => v.id);
        if (!idsRango2.includes(v1) || !idsRango2.includes(v2)) {
            throw new Error(`Fallo filtro (rango2). Esperado ${v1} y ${v2}, obtenido: ${idsRango2.join(',')}`);
        }
        log('Filtro por rango extendido OK');

        log('\nTodas las pruebas de filtros de viajes pasaron correctamente.');
        process.exit(0);
    } catch (err) {
        console.error('ERROR en pruebas:', err.message || err);
        process.exit(1);
    }
})();

import dotenv from 'dotenv';
dotenv.config();

// Servicio de envío de correo al CEO (simulado si falta configuración)
// Soporta dos modos:
// 1) API HTTP (recomendado para producción en Render):
//    - MAIL_API_KEY (o RESEND_API_KEY)
//    - MAIL_FROM (remitente verificado en el proveedor)
// 2) SMTP clásico (útil para desarrollo local):
//    - SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
//    - Opcional: SMTP_SECURE=true (usar TLS implícito).
// Si CEO_EMAIL no está, se buscará usuario con rol='ceo' en la base.

let nodemailer = null;
try {
    nodemailer = await import('nodemailer'); // se carga perezoso
} catch {
    nodemailer = null; // sigue en modo simulación
}

import Usuario from '../models/Usuario.js';
import axios from 'axios';

// Config API (por ejemplo Resend)
const MAIL_API_KEY = process.env.MAIL_API_KEY || process.env.RESEND_API_KEY;
const MAIL_FROM = process.env.MAIL_FROM || process.env.SMTP_USER;

// Config SMTP (uso secundario / local)
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_DEBUG = String(process.env.SMTP_DEBUG || 'false').toLowerCase() === 'true';

function canSendRealEmail() {
    return !!(nodemailer && SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

async function sendEmailViaApi({ to, subject, text }) {
    if (!MAIL_API_KEY || !MAIL_FROM) {
        console.log('[emailService] API email no configurada, se salta a SMTP o modo simulado.', {
            hasApiKey: !!MAIL_API_KEY,
            hasFrom: !!MAIL_FROM
        });
        return { simulated: true, reason: 'api_not_configured' };
    }
    try {
        const response = await axios.post(
            'https://api.resend.com/emails',
            {
                from: MAIL_FROM,
                to,
                subject,
                text
            },
            {
                headers: {
                    Authorization: `Bearer ${MAIL_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const data = response.data || {};

        console.log(`[emailService] (REAL/API) Email enviado a <${to}>: ${subject} -> ${text}`);
        return { simulated: false, provider: 'api', id: data.id || data.messageId };
    } catch (e) {
        console.error('[emailService] ERROR enviando correo vía API:', e?.message || e);
        return { simulated: true, provider: 'api', error: e?.message || String(e) };
    }
}

async function resolveCeoEmail() {
    if (process.env.CEO_EMAIL) return process.env.CEO_EMAIL;
    try {
        const u = await Usuario.findOne({ where: { rol: 'ceo' } });
        return u?.email || 'ceo@example.com';
    } catch (e) {
        console.error('[emailService] Error accediendo a la base de datos para buscar CEO_EMAIL:', e?.message || e);
        return process.env.CEO_EMAIL || 'ceo@example.com';
    }
}

export async function sendEmailToCEO({ subject, text }) {
    const to = await resolveCeoEmail();
    // 1) Intentar primero por API (si está configurada)
    const apiResult = await sendEmailViaApi({ to, subject, text });
    if (!apiResult.simulated) {
        return apiResult;
    }

    // 2) Si la API no está disponible o falla, intentar SMTP
    if (!canSendRealEmail()) {
        console.error('[emailService] MODO SIMULADO: No se puede enviar correo real. Verifica configuración SMTP.');
        console.error(`[emailService] SMTP_HOST=${SMTP_HOST}, SMTP_PORT=${SMTP_PORT}, SMTP_USER=${SMTP_USER}, SMTP_PASS=${SMTP_PASS ? '***' : ''}, nodemailer=${!!nodemailer}`);
        console.log(`[emailService] (SIMULADO) Email al CEO <${to}>: ${subject} -> ${text}`);
        return { simulated: true, smtpConfig: { SMTP_HOST, SMTP_PORT, SMTP_USER, nodemailer: !!nodemailer } };
    }
    try {
        const transporter = nodemailer.default.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            logger: SMTP_DEBUG,
            debug: SMTP_DEBUG,
            tls: { minVersion: 'TLSv1.2' }
        });
        if (SMTP_DEBUG) {
            console.log('[emailService] SMTP config (debug):', { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, user: SMTP_USER });
        }
        const info = await transporter.sendMail({
            from: `Notificador <${SMTP_USER}>`,
            to,
            subject,
            text
        });
        console.log(`[emailService] (REAL) Email enviado al CEO <${to}>: ${subject} -> ${text}`);
        return { simulated: false, messageId: info.messageId };
    } catch (e) {
        console.error('[emailService] ERROR enviando correo real:', e?.message || e);
        console.log(`[emailService] (FALLBACK SIM) Email al CEO <${to}>: ${subject} -> ${text}`);
        return { simulated: true, error: e?.message || String(e) };
    }
}

// Enviar email genérico a un destinatario específico
export async function sendEmail({ to, subject, text }) {
    if (!to) return { simulated: true, error: 'destinatario vacío' };
    // 1) Intentar primero por API (si está configurada)
    const apiResult = await sendEmailViaApi({ to, subject, text });
    if (!apiResult.simulated) {
        return apiResult;
    }

    // 2) Si la API no está disponible o falla, intentar SMTP
    if (!canSendRealEmail()) {
        console.error('[emailService] MODO SIMULADO: No se puede enviar correo real. Verifica configuración SMTP.');
        console.error(`[emailService] SMTP_HOST=${SMTP_HOST}, SMTP_PORT=${SMTP_PORT}, SMTP_USER=${SMTP_USER}, SMTP_PASS=${SMTP_PASS ? '***' : ''}, nodemailer=${!!nodemailer}`);
        console.log(`[emailService] (SIMULADO) Email a <${to}>: ${subject} -> ${text}`);
        return { simulated: true, smtpConfig: { SMTP_HOST, SMTP_PORT, SMTP_USER, nodemailer: !!nodemailer } };
    }
    try {
        const transporter = nodemailer.default.createTransport({
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: { user: SMTP_USER, pass: SMTP_PASS },
            logger: SMTP_DEBUG,
            debug: SMTP_DEBUG,
            tls: { minVersion: 'TLSv1.2' }
        });
        if (SMTP_DEBUG) {
            console.log('[emailService] SMTP config (debug):', { host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_SECURE, user: SMTP_USER });
        }
        const info = await transporter.sendMail({ from: `Notificador <${SMTP_USER}>`, to, subject, text });
        console.log(`[emailService] (REAL) Email enviado a <${to}>: ${subject} -> ${text}`);
        return { simulated: false, messageId: info.messageId };
    } catch (e) {
        console.error('[emailService] ERROR enviando correo real:', e?.message || e);
        console.log(`[emailService] (FALLBACK SIM) Email a <${to}>: ${subject} -> ${text}`);
        return { simulated: true, error: e?.message || String(e) };
    }
}

// Enviar a todos los usuarios con rol camionero
export async function sendEmailToCamioneros({ subject, text }) {
    const list = await Usuario.findAll({ where: { rol: 'camionero' }, attributes: ['email'] });
    const recipients = (list || []).map(u => u.email).filter(Boolean);
    const results = await Promise.allSettled(recipients.map(to => sendEmail({ to, subject, text })));
    const ok = results.filter(r => r.status === 'fulfilled').length;
    return { total: recipients.length, enviados: ok };
}

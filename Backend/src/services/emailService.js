import dotenv from 'dotenv';
dotenv.config();

// Servicio de envío de correo al CEO (simulado si falta configuración SMTP)
// Variables esperadas en .env para envío real:
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Opcional: SMTP_SECURE=true (usar TLS implícito).
// Si CEO_EMAIL no está, se buscará usuario con rol='ceo' en la base.

let nodemailer = null;
try {
    nodemailer = await import('nodemailer'); // se carga perezoso
} catch {
    nodemailer = null; // sigue en modo simulación
}

import Usuario from '../models/Usuario.js';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 0;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
const SMTP_DEBUG = String(process.env.SMTP_DEBUG || 'false').toLowerCase() === 'true';

function canSendRealEmail() {
    return !!(nodemailer && SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
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

import 'dotenv/config';
import nodemailer from 'nodemailer';

// Uso: node backup-notify.js <status> <mensaje> <rutaBackup>
// status: "success" | "error"

async function main() {
    const [, , status = 'error', message = '', backupPath = ''] = process.argv;

    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_SECURE,
        BACKUP_NOTIFY_TO,
        CEO_EMAIL,
    } = process.env;

    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.error('[backup-notify] SMTP no configurado, no se envía email');
        console.error(message);
        return;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT) || 587,
        secure: String(SMTP_SECURE).toLowerCase() === 'true',
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });

    const to = BACKUP_NOTIFY_TO || CEO_EMAIL || SMTP_USER;
    const subjectPrefix = status === 'success' ? '✅ BACKUP OK' : '❌ BACKUP ERROR';

    const lines = [
        `Estado: ${status.toUpperCase()}`,
        message && `Mensaje: ${message}`,
        backupPath && `Archivo: ${backupPath}`,
        `Fecha/Hora: ${new Date().toISOString()}`,
    ].filter(Boolean);

    const text = lines.join('\n');

    await transporter.sendMail({
        from: SMTP_USER,
        to,
        subject: `${subjectPrefix} - Transporte Omar Godoy`,
        text,
    });
}

main().catch((err) => {
    console.error('[backup-notify] Error enviando notificación:', err?.message || err);
});

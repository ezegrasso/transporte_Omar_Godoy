import { sendEmailToCEO } from './emailService.js';

// Test manual de envío de email al CEO
async function testEmail() {
    const subject = 'Prueba de envío de correo (manual)';
    const text = 'Este es un test de envío de correo desde el backend. Si recibís este mail, la configuración SMTP funciona.';
    const result = await sendEmailToCEO({ subject, text });
    console.log('Resultado del envío:', result);
}

// Ejecutar el test manual directamente (compatibilidad ES module)
testEmail();

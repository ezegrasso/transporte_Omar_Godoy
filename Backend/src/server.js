
import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import sequelize, { connectDB, syncModels } from './config/db.js';
import { Op } from 'sequelize';
import { ensureDatabase } from './config/ensureDatabase.js';
import { ensureSchema } from './config/ensureSchema.js';
import camionesRouter from './routes/rutaCamiones.js';
import viajesRouter from './routes/rutaViajes.js';
import usuariosRouter from './routes/rutaUsuario.js';
import authRouter from './routes/auth.js';
import notificacionesRouter from './routes/notificaciones.js';
import iaRouter from './routes/rutaIA.js';
import adelantosRouter from './routes/rutaAdelantos.js';
import estadiasRouter from './routes/rutaEstadias.js';
import combustibleRouter from './routes/rutaCombustible.js';
import finanzasRouter from './routes/rutaFinanzas.js';
import rutaVencimientos from './routes/rutaVencimientos.js';
import { errorHandler } from './middlewares/errorHandler.js';
import rutaAcoplados from './routes/rutaAcoplados.js';
import rutaClientes from './routes/rutaClientes.js';
import rutaComisionistas from './routes/rutaComisionistas.js';
import Usuario from './models/Usuario.js';
import Camion from './models/Camion.js';
import Viaje from './models/Viajes.js';
import Notificacion from './models/Notificacion.js';
import Adelanto from './models/Adelanto.js';
import Estadia from './models/Estadia.js';
import Cliente from './models/Cliente.js';
import './models/Comisionista.js';
import './models/CombustibleMovimiento.js';
import './models/CombustibleStock.js';
import './models/GastoFijo.js';
import Vencimiento from './models/Vencimiento.js';
import { getById as getAcopladoById } from './models/Acoplado.js';
import { setupSwagger } from './config/swagger.js';

dotenv.config();



const app = express();
app.set("trust proxy", 1);
app.use(helmet());
// Soporte de múltiples orígenes en CORS con expansión localhost <-> 127.0.0.1
const corsEnv = process.env.CORS_ORIGIN;
let corsOrigin = '*';
if (corsEnv && corsEnv !== '*') {
    const raw = corsEnv.split(',').map(s => s.trim()).filter(Boolean);
    const set = new Set();
    for (const o of raw) {
        set.add(o);
        const mLocal = o.match(/^http:\/\/localhost:(\d+)$/);
        if (mLocal) set.add(`http://127.0.0.1:${mLocal[1]}`);
        const m127 = o.match(/^http:\/\/127\.0\.0\.1:(\d+)$/);
        if (m127) set.add(`http://localhost:${m127[1]}`);
    }
    const list = Array.from(set);
    corsOrigin = list.length === 1 ? list[0] : list;
}
// Si está habilitado, permitir IPs de red local para puerto 5173 (útil para probar desde celular)
const allowLan5173 = String(process.env.CORS_ALLOW_LAN_5173 || '').toLowerCase() === 'true';
if (allowLan5173 && corsOrigin !== '*') {
    const allowedSet = new Set(Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin]);
    const lanRegex = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}):5173$/;
    app.use(cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true); // non-browser
            if (allowedSet.has(origin)) return callback(null, true);
            if (lanRegex.test(origin)) return callback(null, true);
            return callback(new Error('Not allowed by CORS'), false);
        }
    }));
} else {
    app.use(cors({ origin: corsOrigin }));
}
app.use(morgan('dev'));
app.use(express.json());
// Archivos estáticos subidos (facturas/remitos)
app.use('/uploads', express.static(path.resolve('uploads')));
// Rutas
setupSwagger(app);
app.use('/api/auth', authRouter);
app.use('/api/camiones', camionesRouter);
app.use('/api/viajes', viajesRouter);
app.use('/api/acoplados', rutaAcoplados);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/clientes', rutaClientes);
app.use('/api/intermediarios', rutaComisionistas);
app.use('/api/comisionistas', rutaComisionistas);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/ia', iaRouter);
app.use('/api/adelantos', adelantosRouter);
app.use('/api/estadias', estadiasRouter);
app.use('/api/combustible', combustibleRouter);
app.use('/api/finanzas', finanzasRouter);
app.use('/api/vencimientos', rutaVencimientos);

// Healthcheck simple
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Métricas simples de rendimiento y volumen de viajes
app.get('/health/metrics', async (req, res) => {
    const start = Date.now();
    try {
        const totalViajes = await Viaje.count();
        const pendientes = await Viaje.count({ where: { estado: 'pendiente' } });
        const enCurso = await Viaje.count({ where: { estado: 'en curso' } });
        const finalizados = await Viaje.count({ where: { estado: 'finalizado' } });

        // Conteo de viajes del último mes
        const desde = new Date();
        desde.setMonth(desde.getMonth() - 1);
        const yyyy = desde.getFullYear();
        const mm = String(desde.getMonth() + 1).padStart(2, '0');
        const dd = String(desde.getDate()).padStart(2, '0');
        const desdeStr = `${yyyy}-${mm}-${dd}`; // DATEONLY

        const recientes = await Viaje.count({ where: { fecha: { [Op.gte]: desdeStr } } });

        const durationMs = Date.now() - start;
        res.json({
            status: 'ok',
            durationMs,
            viajes: { total: totalViajes, pendientes, enCurso, finalizados, ultimos30Dias: recientes }
        });
    } catch (e) {
        res.status(500).json({ status: 'error', error: e?.message || String(e) });
    }
});

// Error handler al final
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

(async () => {
    // Ejecutar ensureDatabase solo en desarrollo/local o si está habilitado explícitamente
    const isLocalHost = (host) => {
        const h = String(host || '').toLowerCase();
        return h === 'localhost' || h === '127.0.0.1';
    };
    const enableEnsureDb = String(process.env.ENABLE_ENSURE_DATABASE || 'false').toLowerCase() === 'true';
    if (enableEnsureDb || isLocalHost(process.env.DB_HOST)) {
        await ensureDatabase();
    }
    await connectDB();
    await ensureSchema();
    await syncModels();
    // Crear CEO inicial si no existe:
    // 1) Usa CEO_EMAIL/CEO_PASSWORD si están definidos.
    // 2) Caso contrario, crea por defecto ceo@example.com / ceo123.
    const seedEmail = process.env.CEO_EMAIL || 'ceo@example.com';
    const seedPass = process.env.CEO_PASSWORD || 'ceo123';
    const existe = await Usuario.findOne({ where: { email: seedEmail } });
    if (!existe) {
        await Usuario.create({ nombre: 'CEO', email: seedEmail, password: seedPass, rol: 'ceo' });
        console.log(`Usuario CEO creado (${seedEmail})`);
    }
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
    });

    // Tarea: marcar facturas vencidas y notificar
    const runCheckVencidas = async () => {
        try {
            const all = await Viaje.findAll();
            const now = Date.now();
            let created = 0; let updated = 0;
            for (const v of all) {
                const fechaBase = v.fechaFactura || v.fecha;
                const estado = (v.facturaEstado || 'pendiente').toLowerCase();
                if (fechaBase && estado !== 'cobrada') {
                    const days = Math.floor((now - new Date(fechaBase).getTime()) / (1000 * 60 * 60 * 24));
                    if (days > 30) {
                        if (estado !== 'vencida') { v.facturaEstado = 'vencida'; updated++; }
                        if (!v.facturaNotificadaVencida) {
                            await Notificacion.create({ tipo: 'factura_vencida', mensaje: `Factura vencida del viaje #${v.id} (${v.cliente || 'Cliente desconocido'})` });
                            v.facturaNotificadaVencida = true;
                            created++;
                        }
                        await v.save();
                    }
                }
            }
            if (updated || created) console.log(`[checkVencidas] marcadas:${updated}, notificaciones:${created}`);
        } catch (e) {
            console.warn('[checkVencidas] error', e?.message || e);
        }
    };

    // Tarea: revisar vencimientos (técnica/seguro/senasa) y notificar cuando expiren
    const runCheckVencimientos = async () => {
        try {
            const today = new Date();
            const iso = today.toISOString().slice(0, 10);
            const pendientes = await Vencimiento.findAll({ where: { fechaHasta: { [Op.lte]: iso }, notificado: false } });

            const itemLabel = {
                tecnica: 'Técnica',
                seguro: 'Seguro',
                senasa: 'Senasa',
                carnet: 'Carnet',
                curso_profesional: 'Curso profesional',
                psicofisico: 'Psicofísico',
            };

            const formatDate = (dateOnly) => {
                try {
                    const [y, m, d] = String(dateOnly || '').split('-').map(Number);
                    if (!y || !m || !d) return String(dateOnly || '');
                    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
                } catch {
                    return String(dateOnly || '');
                }
            };

            let created = 0;
            for (const v of pendientes) {
                const label = itemLabel[v.item] || v.item;
                let referencia = `${v.tipoObjeto} #${v.objetoId}`;

                if (v.tipoObjeto === 'camion') {
                    const camion = await Camion.findByPk(v.objetoId, { attributes: ['patente'] });
                    referencia = camion?.patente
                        ? `camión patente ${camion.patente}`
                        : `camión #${v.objetoId}`;
                } else if (v.tipoObjeto === 'camionero') {
                    const chofer = await Usuario.findByPk(v.objetoId, { attributes: ['nombre'] });
                    referencia = chofer?.nombre
                        ? `camionero ${chofer.nombre}`
                        : `camionero #${v.objetoId}`;
                } else if (v.tipoObjeto === 'acoplado') {
                    const acoplado = await getAcopladoById(v.objetoId);
                    referencia = acoplado?.patente
                        ? `acoplado patente ${acoplado.patente}`
                        : `acoplado #${v.objetoId}`;
                }

                const texto = `Se detectó un vencimiento de ${label} correspondiente al ${referencia}. Fecha de vencimiento: ${formatDate(v.fechaHasta)}.`;
                const destinatarioRol = v.tipoObjeto === 'camionero' ? 'camionero' : null;
                const destinatarioId = v.tipoObjeto === 'camionero' ? v.objetoId : null;
                await Notificacion.create({
                    tipo: 'vencimiento',
                    mensaje: texto,
                    destinatarioRol,
                    destinatarioId,
                });
                // Enviar email al CEO y al equipo de administración
                try {
                    // import dinámico para evitar ciclos
                    const { sendEmailToCEO, sendEmailToAdministracion } = await import('./services/emailService.js');
                    await sendEmailToCEO({ subject: 'Vencimiento vencido', text: texto });
                    await sendEmailToAdministracion({ subject: 'Vencimiento vencido', text: texto });
                } catch (e) {
                    console.warn('[checkVencimientos] error enviando email:', e?.message || e);
                }
                v.notificado = true;
                await v.save();
                created++;
            }
            if (created) console.log(`[checkVencimientos] notificaciones:${created}`);
        } catch (e) {
            console.warn('[checkVencimientos] error', e?.message || e);
        }
    };

    const onBoot = String(process.env.CHECK_VENCIDAS_ON_BOOT ?? 'true').toLowerCase() === 'true';
    const intervalMin = Number(process.env.CHECK_VENCIDAS_INTERVAL_MIN ?? 1440); // por defecto, diario
    if (onBoot) runCheckVencidas();
    if (intervalMin > 0) setInterval(runCheckVencidas, intervalMin * 60 * 1000);

    // Programar chequeo de vencimientos con la misma cadencia
    const onBootV = String(process.env.CHECK_VENCIMIENTOS_ON_BOOT ?? 'true').toLowerCase() === 'true';
    if (onBootV) runCheckVencimientos();
    if (intervalMin > 0) setInterval(runCheckVencimientos, intervalMin * 60 * 1000);
})();


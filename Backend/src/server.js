
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import sequelize, { connectDB, syncModels } from './config/db.js';
import { ensureDatabase } from './config/ensureDatabase.js';
import { ensureSchema } from './config/ensureSchema.js';
import camionesRouter from './routes/rutaCamiones.js';
import viajesRouter from './routes/rutaViajes.js';
import usuariosRouter from './routes/rutaUsuario.js';
import authRouter from './routes/auth.js';
import { errorHandler } from './middlewares/errorHandler.js';
import Usuario from './models/Usuario.js';
import './models/Camion.js';
import './models/Viajes.js';
import { setupSwagger } from './config/swagger.js';

dotenv.config();



const app = express();
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
app.use(cors({ origin: corsOrigin }));
app.use(morgan('dev'));
app.use(express.json());
// Rutas
setupSwagger(app);
app.use('/api/auth', authRouter);
app.use('/api/camiones', camionesRouter);
app.use('/api/viajes', viajesRouter);
app.use('/api/usuarios', usuariosRouter);

// Healthcheck simple
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Error handler al final
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

(async () => {
    await ensureDatabase();
    await connectDB();
    await ensureSchema();
    await syncModels();
    // Crear admin inicial si no existe y hay envs configurados
    if (process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        const existeAdmin = await Usuario.findOne({ where: { email: process.env.ADMIN_EMAIL } });
        if (!existeAdmin) {
            await Usuario.create({ nombre: 'Admin', email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD, rol: 'admin' });
            console.log('Usuario admin creado');
        }
    }
    app.listen(PORT, () => {
        console.log(`Servidor escuchando en el puerto ${PORT}`);
    });
})();



import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Detectar si el host es local para decidir SSL
const isLocalHost = (host) => {
    const h = String(host || '').toLowerCase();
    return h === 'localhost' || h === '127.0.0.1';
};

const shouldUseSSL = (() => {
    // Permite forzar/desactivar vía env:
    // DB_SSL=true/false. Por defecto: usa SSL si no es localhost
    const envVal = String(process.env.DB_SSL || '').toLowerCase();
    if (envVal === 'true') return true;
    if (envVal === 'false') return false;
    return !isLocalHost(process.env.DB_HOST);
})();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: 'mysql',
        logging: false,
        pool: {
            max: 10,
            min: 0,
            acquire: 60000,
            idle: 10000
        },
        dialectOptions: shouldUseSSL ? {
            ssl: {
                // En Render y muchos proveedores, no se facilita CA.
                // Para compatibilidad, no rechazamos por falta de CA.
                require: true,
                rejectUnauthorized: false
            }
        } : {}
    }
);

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexión a la base de datos establecida correctamente.');
    } catch (error) {
        console.error('No se pudo conectar a la base de datos:', error?.message || error);
        process.exit(1);
    }
};

export default sequelize;

// Sincronizar modelos con la base de datos (los modelos deben estar importados previamente desde server.js)
export const syncModels = async () => {
    try {
        // Si DB_ALTER_ON_BOOT está explícitamente en false, no altera
        // Si está en true O no está definido, altera (seguridad: alter añade columnas, no las borra)
        const doAlterExplicitlyDisabled = String(process.env.DB_ALTER_ON_BOOT || '').toLowerCase() === 'false';
        const shouldAlter = !doAlterExplicitlyDisabled;

        await sequelize.sync({ alter: shouldAlter });
        console.log(`Modelos sincronizados (alter: ${shouldAlter}).`);
    } catch (error) {
        console.error('Error al sincronizar los modelos:', error);
    }
};

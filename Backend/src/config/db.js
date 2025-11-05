
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

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
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    }
);

export const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('Conexión a la base de datos establecida correctamente.');
    } catch (error) {
        console.error('No se pudo conectar a la base de datos:', error);
        process.exit(1);
    }
};

export default sequelize;

// Sincronizar modelos con la base de datos (los modelos deben estar importados previamente desde server.js)
export const syncModels = async () => {
    try {
        // Evitar alteraciones automáticas que puedan fallar por constraints inexistentes
        await sequelize.sync();
        console.log('Modelos sincronizados con la base de datos.');
    } catch (error) {
        console.error('Error al sincronizar los modelos:', error);
    }
};

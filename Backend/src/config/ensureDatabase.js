import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const ensureDatabase = async () => {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_NAME) throw new Error('Falta DB_NAME en .env');

    // Evitar intentar crear base en proveedores gestionados (Render) por defecto.
    // Solo ejecutar si ENABLE_ENSURE_DATABASE=true o si es localhost.
    const isLocalHost = (host) => {
        const h = String(host || '').toLowerCase();
        return h === 'localhost' || h === '127.0.0.1';
    };
    const enableExplicit = String(process.env.ENABLE_ENSURE_DATABASE || 'false').toLowerCase() === 'true';
    if (!enableExplicit && !isLocalHost(DB_HOST)) {
        console.log("ensureDatabase: omitido (host no local y ENABLE_ENSURE_DATABASE != 'true')");
        return;
    }

    const useSSL = !isLocalHost(DB_HOST);
    const connection = await mysql.createConnection({
        host: DB_HOST || 'localhost',
        port: DB_PORT ? Number(DB_PORT) : 3306,
        user: DB_USER,
        password: DB_PASSWORD,
        multipleStatements: true,
        // En entornos gestionados, muchas veces se requiere SSL
        ssl: useSSL ? { rejectUnauthorized: false } : undefined
    });
    await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await connection.end();
    console.log(`Base de datos '${DB_NAME}' verificada/creada.`);
};

export default ensureDatabase;

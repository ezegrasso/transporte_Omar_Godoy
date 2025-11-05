import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

export const ensureDatabase = async () => {
    const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = process.env;
    if (!DB_NAME) throw new Error('Falta DB_NAME en .env');

    const connection = await mysql.createConnection({
        host: DB_HOST || 'localhost',
        port: DB_PORT ? Number(DB_PORT) : 3306,
        user: DB_USER,
        password: DB_PASSWORD,
        multipleStatements: true
    });
    await connection.query(
        `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
    );
    await connection.end();
    console.log(`Base de datos '${DB_NAME}' verificada/creada.`);
};

export default ensureDatabase;

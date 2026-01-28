import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

async function addColumn() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        await connection.query('ALTER TABLE viajes ADD COLUMN observaciones TEXT NULL');
        console.log('✓ Columna observaciones agregada exitosamente');
    } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('✓ Columna observaciones ya existe');
        } else {
            console.error('✗ Error:', error.message);
        }
    } finally {
        await connection.end();
    }
}

addColumn();

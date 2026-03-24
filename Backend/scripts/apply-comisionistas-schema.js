import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT || 3306),
        dialect: 'mysql',
        logging: false
    }
);

const existsRows = (rows) => Array.isArray(rows) && rows.length > 0;

async function applySchema() {
    await sequelize.authenticate();

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS comisionistas (
            id INT AUTO_INCREMENT PRIMARY KEY,
            nombre VARCHAR(255) NOT NULL UNIQUE,
            porcentaje DECIMAL(5,2) NOT NULL DEFAULT 0,
            createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);

    const [comisionistaIdColumn] = await sequelize.query("SHOW COLUMNS FROM viajes LIKE 'comisionistaId'");
    if (!existsRows(comisionistaIdColumn)) {
        await sequelize.query('ALTER TABLE viajes ADD COLUMN comisionistaId INT NULL');
    }

    const [comisionPorcentajeColumn] = await sequelize.query("SHOW COLUMNS FROM viajes LIKE 'comisionPorcentaje'");
    if (!existsRows(comisionPorcentajeColumn)) {
        await sequelize.query('ALTER TABLE viajes ADD COLUMN comisionPorcentaje DECIMAL(5,2) NULL');
    }

    const [indexRows] = await sequelize.query("SHOW INDEX FROM viajes WHERE Key_name = 'idx_viajes_comisionistaId'");
    if (!existsRows(indexRows)) {
        await sequelize.query('CREATE INDEX idx_viajes_comisionistaId ON viajes (comisionistaId)');
    }

    const [fkRows] = await sequelize.query(`
        SELECT CONSTRAINT_NAME
        FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'viajes'
          AND COLUMN_NAME = 'comisionistaId'
          AND REFERENCED_TABLE_NAME = 'comisionistas'
    `);

    if (!existsRows(fkRows)) {
        await sequelize.query(`
            ALTER TABLE viajes
            ADD CONSTRAINT fk_viajes_comisionista
            FOREIGN KEY (comisionistaId)
            REFERENCES comisionistas(id)
            ON UPDATE CASCADE
            ON DELETE SET NULL
        `);
    }

    console.log('Schema comisionistas aplicado OK');
}

applySchema()
    .then(async () => {
        await sequelize.close();
        process.exit(0);
    })
    .catch(async (e) => {
        console.error('Error aplicando schema comisionistas:', e?.message || e);
        try {
            await sequelize.close();
        } catch {
            // no-op
        }
        process.exit(1);
    });

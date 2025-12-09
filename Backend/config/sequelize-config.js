import path from 'path';

const env = process.env.NODE_ENV || 'development';
const common = {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'transporte_omar_godoy',
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    dialect: 'mysql',
    logging: false,
};

export default {
    development: common,
    test: {
        ...common,
        database: process.env.DB_NAME_TEST || `${common.database}_test`
    },
    production: {
        ...common,
        logging: false
    }
};

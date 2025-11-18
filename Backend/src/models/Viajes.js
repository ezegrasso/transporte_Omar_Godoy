
import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Viaje = sequelize.define('Viaje', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    origen: {
        type: DataTypes.STRING,
        allowNull: false
    },
    destino: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATE,
        allowNull: false
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'en curso', 'finalizado'),
        defaultValue: 'pendiente',
        allowNull: false
    },
    km: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    combustible: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    // Gestión administrativa
    facturaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    remitosJson: {
        type: DataTypes.TEXT, // JSON array de URLs
        allowNull: true
    },
    facturaEstado: {
        type: DataTypes.STRING, // 'pendiente' | 'cobrada' | 'no cobrada'
        allowNull: true
    },
    fechaFactura: {
        type: DataTypes.DATE,
        allowNull: true
    },
    facturaNotificadaVencida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    tipoMercaderia: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cliente: {
        type: DataTypes.STRING,
        allowNull: true
    },
    camionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'camiones',
            key: 'id'
        }
    },
    camioneroId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    // Campos históricos para mantener nombre y email aunque se elimine el usuario camionero
    camioneroNombre: {
        type: DataTypes.STRING,
        allowNull: true
    },
    camioneroEmail: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'viajes',
    timestamps: false
});

export default Viaje;
import Usuario from './Usuario.js';
Viaje.belongsTo(Usuario, { as: 'camionero', foreignKey: 'camioneroId' });

import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Adelanto = sequelize.define('Adelanto', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    camioneroId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    monto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    mes: {
        type: DataTypes.INTEGER,
        allowNull: false, // 1-12
        validate: { min: 1, max: 12 }
    },
    anio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    creadoPor: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'adelantos',
    timestamps: true
});

export default Adelanto;

import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Estadia = sequelize.define('Estadia', {
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
    fechaInicio: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    fechaFin: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    mes: {
        type: DataTypes.INTEGER,
        allowNull: false, // 1-12 (basado en fechaInicio)
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
    createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    timestamps: true,
    tableName: 'estadias'
});

export default Estadia;

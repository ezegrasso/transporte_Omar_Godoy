import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Cliente = sequelize.define('Cliente', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    nombre: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    cuit: {
        type: DataTypes.STRING,
        allowNull: true,
        unique: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'Clientes',
    timestamps: true,
    indexes: [
        { fields: ['nombre'] },
        { fields: ['cuit'] }
    ]
});

export default Cliente;

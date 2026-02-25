import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const CombustibleStock = sequelize.define('CombustibleStock', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    disponibleLitros: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    precioUnitarioPredio: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0
    },
    updatedById: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    }
}, {
    tableName: 'combustible_stock',
    timestamps: true
});

export default CombustibleStock;

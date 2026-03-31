import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const GastoFijo = sequelize.define('GastoFijo', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    concepto: {
        type: DataTypes.STRING,
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    mes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        validate: { min: 1, max: 12 }
    },
    anio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    creadoPor: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    }
}, {
    tableName: 'gastos_fijos',
    timestamps: true
});

export default GastoFijo;

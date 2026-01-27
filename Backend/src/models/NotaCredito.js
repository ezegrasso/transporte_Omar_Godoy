import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const NotaCredito = sequelize.define('NotaCredito', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    viajeId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'viajes',
            key: 'id'
        }
    },
    motivo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    monto: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    descripcion: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    fechaCreacion: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'notas_credito',
    timestamps: false
});

export default NotaCredito;


import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Camion = sequelize.define('Camion', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    patente: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    marca: {
        type: DataTypes.STRING,
        allowNull: false
    },
    modelo: {
        type: DataTypes.STRING,
        allowNull: false
    },
    anio: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    camioneroId: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'camiones',
    timestamps: false
});

export default Camion;

// Relación: Un Camion tiene muchos Viajes
import Viaje from './Viajes.js';
Camion.hasMany(Viaje, { foreignKey: 'camionId' });
Viaje.belongsTo(Camion, { as: 'camion', foreignKey: 'camionId' });

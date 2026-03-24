import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Comisionista = sequelize.define('Comisionista', {
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
    porcentaje: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
    }
}, {
    tableName: 'comisionistas',
    timestamps: true
});

export default Comisionista;

import Viaje from './Viajes.js';
Comisionista.hasMany(Viaje, { as: 'viajesComisionados', foreignKey: 'comisionistaId' });
Viaje.belongsTo(Comisionista, { as: 'comisionista', foreignKey: 'comisionistaId' });

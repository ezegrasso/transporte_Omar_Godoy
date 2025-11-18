import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Notificacion = sequelize.define('Notificacion', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    tipo: { type: DataTypes.STRING, allowNull: false },
    mensaje: { type: DataTypes.STRING, allowNull: false },
    fecha: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    leida: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
    tableName: 'notificaciones',
    timestamps: false
});

export default Notificacion;

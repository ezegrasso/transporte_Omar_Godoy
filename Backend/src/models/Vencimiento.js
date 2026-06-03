import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Vencimiento = sequelize.define('Vencimiento', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    tipoObjeto: { type: DataTypes.ENUM('camion', 'acoplado', 'camionero'), allowNull: false },
    objetoId: { type: DataTypes.INTEGER, allowNull: false },
    item: { type: DataTypes.ENUM('tecnica', 'seguro', 'senasa', 'carnet', 'curso_profesional', 'psicofisico'), allowNull: false },
    fechaDesde: { type: DataTypes.DATEONLY, allowNull: true },
    fechaHasta: { type: DataTypes.DATEONLY, allowNull: true },
    observaciones: { type: DataTypes.TEXT, allowNull: true },
    notificado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    creadoPor: { type: DataTypes.INTEGER, allowNull: true }
}, {
    tableName: 'vencimientos',
    timestamps: true
});

export default Vencimiento;

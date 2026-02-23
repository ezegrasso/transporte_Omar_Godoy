import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const CombustibleMovimiento = sequelize.define('CombustibleMovimiento', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    camionId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'camiones',
            key: 'id'
        }
    },
    camioneroId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    fechaCarga: {
        type: DataTypes.DATEONLY,
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
    litros: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    lugar: {
        type: DataTypes.STRING,
        allowNull: false
    },
    origen: {
        type: DataTypes.ENUM('predio', 'externo', 'ajuste'),
        allowNull: false,
        defaultValue: 'externo'
    },
    tipoRegistro: {
        type: DataTypes.ENUM('carga', 'ajuste'),
        allowNull: false,
        defaultValue: 'carga'
    },
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'combustible_movimientos',
    timestamps: true
});

export default CombustibleMovimiento;

import Camion from './Camion.js';
import Usuario from './Usuario.js';

CombustibleMovimiento.belongsTo(Camion, { as: 'camion', foreignKey: 'camionId' });
CombustibleMovimiento.belongsTo(Usuario, { as: 'camionero', foreignKey: 'camioneroId' });

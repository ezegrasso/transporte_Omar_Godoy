
import { DataTypes } from 'sequelize';
import sequelize from '../config/db.js';

const Viaje = sequelize.define('Viaje', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    origen: {
        type: DataTypes.STRING,
        allowNull: false
    },
    destino: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fecha: {
        type: DataTypes.DATEONLY, // almacena solo la fecha (YYYY-MM-DD) sin zona horaria
        allowNull: false
    },
    estado: {
        type: DataTypes.ENUM('pendiente', 'en curso', 'finalizado'),
        defaultValue: 'pendiente',
        allowNull: false
    },
    km: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    combustible: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    // Cálculo económico
    precioTonelada: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    kilosCargados: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    importe: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    // Gestión administrativa
    facturaUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    remitosJson: {
        type: DataTypes.TEXT, // JSON array de URLs
        allowNull: true
    },
    facturaEstado: {
        type: DataTypes.STRING, // 'pendiente' | 'cobrada' | 'no cobrada'
        allowNull: true
    },
    fechaFactura: {
        type: DataTypes.DATEONLY, // solo fecha para evitar desfases por timezone
        allowNull: true
    },
    facturaNotificadaVencida: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    ivaPercentaje: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        defaultValue: 0
    },
    precioUnitarioFactura: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    precioUnitarioNegro: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    tipoMercaderia: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cliente: {
        type: DataTypes.STRING,
        allowNull: true
    },
    camionId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'camiones',
            key: 'id'
        }
    },
    camioneroId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'usuarios',
            key: 'id'
        }
    },
    acopladoId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'acoplados',
            key: 'id'
        }
    },
    // Campos históricos para mantener nombre y email aunque se elimine el usuario camionero
    camioneroNombre: {
        type: DataTypes.STRING,
        allowNull: true
    },
    camioneroEmail: {
        type: DataTypes.STRING,
        allowNull: true
    },
    observacionesAdmin: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observacionesCeo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    observacionesCamionero: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    // Campo legacy para compatibilidad
    observaciones: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'viajes',
    timestamps: false,
    hooks: {
        afterFind: (results) => {
            // Normalizar fechas DATEONLY a formato ISO (YYYY-MM-DD)
            const normalizeDate = (v) => {
                if (!v) return v;
                if (v.fecha && typeof v.fecha === 'string') {
                    // Si ya está en ISO format, déjalo
                    if (/^\d{4}-\d{2}-\d{2}$/.test(v.fecha)) {
                        return v;
                    }
                    // Si no, intenta convertir
                    try {
                        const date = new Date(v.fecha);
                        const iso = date.toISOString().split('T')[0];
                        v.fecha = iso;
                    } catch { /* keep original */ }
                }
                return v;
            };
            if (Array.isArray(results)) {
                return results.map(normalizeDate);
            } else if (results) {
                return normalizeDate(results);
            }
            return results;
        }
    }

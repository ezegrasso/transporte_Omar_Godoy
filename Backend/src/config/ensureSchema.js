import { DataTypes } from 'sequelize';
import sequelize from './db.js';

// Asegura cambios de esquema que no están cubiertos por sync() (sin alter)
export const ensureSchema = async () => {
    const qi = sequelize.getQueryInterface();
    // Asegurar columna avatarUrl en usuarios
    try {
        const desc = await qi.describeTable('usuarios');
        if (!('avatarUrl' in desc)) {
            await qi.addColumn('usuarios', 'avatarUrl', { type: DataTypes.STRING, allowNull: true });
            console.log("Columna 'avatarUrl' añadida a 'usuarios'.");
        }
        // (Eliminado: columnas telefono / ultimoWhatsappAt ya no se aseguran)
    } catch (e) {
        console.error('No se pudo asegurar esquema de usuarios:', e);
    }

    // Asegurar columnas historicas de camionero en viajes
    try {
        const descV = await qi.describeTable('viajes');
        // Convertir columnas de fecha a DATEONLY para evitar desfases por timezone
        if ('fecha' in descV && descV.fecha.type.toLowerCase().includes('datetime')) {
            await qi.changeColumn('viajes', 'fecha', { type: DataTypes.DATEONLY, allowNull: false });
            console.log("Columna 'fecha' cambiada a DATEONLY en 'viajes'.");
            try {
                await sequelize.query("UPDATE viajes SET fecha = DATE(fecha) WHERE fecha IS NOT NULL");
                console.log("Normalización aplicada: 'fecha' => DATE(fecha)");
            } catch (e) { console.warn('No se pudo normalizar fechas (fecha):', e?.message || e); }
        }
        if ('fechaFactura' in descV && descV.fechaFactura.type && descV.fechaFactura.type.toLowerCase().includes('datetime')) {
            await qi.changeColumn('viajes', 'fechaFactura', { type: DataTypes.DATEONLY, allowNull: true });
            console.log("Columna 'fechaFactura' cambiada a DATEONLY en 'viajes'.");
            try {
                await sequelize.query("UPDATE viajes SET fechaFactura = DATE(fechaFactura) WHERE fechaFactura IS NOT NULL");
                console.log("Normalización aplicada: 'fechaFactura' => DATE(fechaFactura)");
            } catch (e) { console.warn('No se pudo normalizar fechas (fechaFactura):', e?.message || e); }
        }
        if (!('camioneroNombre' in descV)) {
            await qi.addColumn('viajes', 'camioneroNombre', { type: DataTypes.STRING, allowNull: true });
            console.log("Columna 'camioneroNombre' añadida a 'viajes'.");
        }
        if (!('camioneroEmail' in descV)) {
            await qi.addColumn('viajes', 'camioneroEmail', { type: DataTypes.STRING, allowNull: true });
            console.log("Columna 'camioneroEmail' añadida a 'viajes'.");
        }
        // Confirmación final del viaje (nuevo doble paso)
        if (!('finalizadoConfirmadoPor' in descV)) {
            await qi.addColumn('viajes', 'finalizadoConfirmadoPor', { type: DataTypes.INTEGER, allowNull: true });
            console.log("Columna 'finalizadoConfirmadoPor' añadida a 'viajes'.");
        }
        if (!('finalizadoConfirmadoAt' in descV)) {
            await qi.addColumn('viajes', 'finalizadoConfirmadoAt', { type: DataTypes.DATE, allowNull: true });
            console.log("Columna 'finalizadoConfirmadoAt' añadida a 'viajes'.");
        }
        // AcopladoId en viajes
        if (!('acopladoId' in descV)) {
            await qi.addColumn('viajes', 'acopladoId', { type: DataTypes.INTEGER, allowNull: true });
            console.log("Columna 'acopladoId' añadida a 'viajes'.");
        }
        // Campos económicos para liquidación
        if (!('precioTonelada' in descV)) {
            await qi.addColumn('viajes', 'precioTonelada', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
            console.log("Columna 'precioTonelada' añadida a 'viajes'.");
        }
        if (!('kilosCargados' in descV)) {
            await qi.addColumn('viajes', 'kilosCargados', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
            console.log("Columna 'kilosCargados' añadida a 'viajes'.");
        }
        if (!('importe' in descV)) {
            await qi.addColumn('viajes', 'importe', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
            console.log("Columna 'importe' añadida a 'viajes'.");
        }
        if (!('ivaPercentaje' in descV)) {
            await qi.addColumn('viajes', 'ivaPercentaje', { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 });
            console.log("Columna 'ivaPercentaje' añadida a 'viajes'.");
        }
        if (!('precioUnitarioFactura' in descV)) {
            await qi.addColumn('viajes', 'precioUnitarioFactura', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
            console.log("Columna 'precioUnitarioFactura' añadida a 'viajes'.");
        }
        if (!('precioUnitarioNegro' in descV)) {
            await qi.addColumn('viajes', 'precioUnitarioNegro', { type: DataTypes.DECIMAL(10, 2), allowNull: true });
            console.log("Columna 'precioUnitarioNegro' añadida a 'viajes'.");
        }

        // Índices recomendados para escalar consultas en viajes
        try {
            const [indexes] = await sequelize.query("SHOW INDEX FROM viajes");
            const hasIndex = (name) => indexes?.some((i) => i?.Key_name === name);

            if (!hasIndex('idx_viajes_fecha')) {
                await qi.addIndex('viajes', ['fecha'], { name: 'idx_viajes_fecha' });
                console.log("Índice 'idx_viajes_fecha' creado en 'viajes'(fecha).");
            }
            if (!hasIndex('idx_viajes_estado')) {
                await qi.addIndex('viajes', ['estado'], { name: 'idx_viajes_estado' });
                console.log("Índice 'idx_viajes_estado' creado en 'viajes'(estado).");
            }
            if (!hasIndex('idx_viajes_camioneroId')) {
                await qi.addIndex('viajes', ['camioneroId'], { name: 'idx_viajes_camioneroId' });
                console.log("Índice 'idx_viajes_camioneroId' creado en 'viajes'(camioneroId).");
            }
            if (!hasIndex('idx_viajes_cliente')) {
                await qi.addIndex('viajes', ['cliente'], { name: 'idx_viajes_cliente' });
                console.log("Índice 'idx_viajes_cliente' creado en 'viajes'(cliente).");
            }
        } catch (e) {
            console.warn('No se pudieron asegurar índices en viajes:', e?.message || e);
        }
    } catch (e) {
        console.error('No se pudo asegurar esquema de viajes:', e);
    }

    // Asegurar tabla acoplados (simple)
    try {
        await sequelize.getQueryInterface().createTable('acoplados', {
            id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
            patente: { type: DataTypes.STRING, allowNull: false, unique: true }
        });
        console.log("Tabla 'acoplados' asegurada.");
    } catch (e) {
        // si ya existe, ignorar
    }

    // Asegurar columna camioneroId en camiones
    try {
        const descC = await qi.describeTable('camiones');
        if (!('camioneroId' in descC)) {
            await qi.addColumn('camiones', 'camioneroId', { type: DataTypes.INTEGER, allowNull: true });
            console.log("Columna 'camioneroId' añadida a 'camiones'.");
        }
    } catch (e) {
        console.error('No se pudo asegurar esquema de camiones:', e);
    }

    // Asegurar tabla notas_credito
    try {
        const descNC = await qi.describeTable('notas_credito');
        // Tabla ya existe
    } catch (e) {
        if (e.message.includes('notas_credito')) {
            // Tabla no existe, crearla
            try {
                await sequelize.query(`
                    CREATE TABLE notas_credito (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        viajeId INT NOT NULL,
                        motivo VARCHAR(255) NOT NULL,
                        monto DECIMAL(10, 2) NOT NULL,
                        descripcion LONGTEXT,
                        fechaCreacion DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (viajeId) REFERENCES viajes(id) ON DELETE CASCADE
                    )
                `);
                console.log("Tabla 'notas_credito' creada.");
            } catch (err) {
                console.error('Error al crear tabla notas_credito:', err);
            }
        } else {
            console.error('Error al verificar tabla notas_credito:', e);
        }
    }
};

export default ensureSchema;

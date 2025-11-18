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
    } catch (e) {
        console.error('No se pudo asegurar esquema de usuarios:', e);
    }

    // Asegurar columnas historicas de camionero en viajes
    try {
        const descV = await qi.describeTable('viajes');
        if (!('camioneroNombre' in descV)) {
            await qi.addColumn('viajes', 'camioneroNombre', { type: DataTypes.STRING, allowNull: true });
            console.log("Columna 'camioneroNombre' añadida a 'viajes'.");
        }
        if (!('camioneroEmail' in descV)) {
            await qi.addColumn('viajes', 'camioneroEmail', { type: DataTypes.STRING, allowNull: true });
            console.log("Columna 'camioneroEmail' añadida a 'viajes'.");
        }
    } catch (e) {
        console.error('No se pudo asegurar esquema de viajes:', e);
    }
};

export default ensureSchema;

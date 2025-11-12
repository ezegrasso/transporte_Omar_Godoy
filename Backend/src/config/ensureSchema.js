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
};

export default ensureSchema;

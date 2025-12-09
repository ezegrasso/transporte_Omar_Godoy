// Modelo Acoplado (ESM): solo patente única
import sequelize from '../config/db.js';
import { QueryTypes } from 'sequelize';

export async function getAll() {
    const rows = await sequelize.query('SELECT id, patente FROM acoplados ORDER BY patente ASC', { type: QueryTypes.SELECT });
    return rows;
}

export async function getById(id) {
    const rows = await sequelize.query('SELECT id, patente FROM acoplados WHERE id = ?', { replacements: [id], type: QueryTypes.SELECT });
    return rows[0] || null;
}

export async function create({ patente }) {
    if (!patente) throw new Error('Patente requerida');
    await sequelize.query('INSERT INTO acoplados (patente) VALUES (?)', { replacements: [patente], type: QueryTypes.INSERT });
}

export async function update(id, { patente }) {
    if (!patente) throw new Error('Patente requerida');
    await sequelize.query('UPDATE acoplados SET patente = ? WHERE id = ?', { replacements: [patente, id], type: QueryTypes.UPDATE });
}

export async function remove(id) {
    await sequelize.query('DELETE FROM acoplados WHERE id = ?', { replacements: [id], type: QueryTypes.DELETE });
}

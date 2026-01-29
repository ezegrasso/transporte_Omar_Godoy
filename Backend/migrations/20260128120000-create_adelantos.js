'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('adelantos', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            camioneroId: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'usuarios',
                    key: 'id'
                }
            },
            monto: {
                type: Sequelize.DECIMAL(10, 2),
                allowNull: false
            },
            mes: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            anio: {
                type: Sequelize.INTEGER,
                allowNull: false
            },
            descripcion: {
                type: Sequelize.TEXT,
                allowNull: true
            },
            creadoPor: {
                type: Sequelize.INTEGER,
                allowNull: true,
                references: {
                    model: 'usuarios',
                    key: 'id'
                }
            },
            createdAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            },
            updatedAt: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.NOW
            }
        });

        // Crear índices para búsquedas frecuentes
        await queryInterface.addIndex('adelantos', ['camioneroId', 'mes', 'anio']);
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.dropTable('adelantos');
    }
};

'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('comisionistas', {
            id: {
                type: Sequelize.INTEGER,
                autoIncrement: true,
                primaryKey: true
            },
            nombre: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true
            },
            porcentaje: {
                type: Sequelize.DECIMAL(5, 2),
                allowNull: false,
                defaultValue: 0
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.NOW
            }
        });

        await queryInterface.addColumn('viajes', 'comisionistaId', {
            type: Sequelize.INTEGER,
            allowNull: true,
            references: {
                model: 'comisionistas',
                key: 'id'
            },
            onUpdate: 'CASCADE',
            onDelete: 'SET NULL'
        });

        await queryInterface.addColumn('viajes', 'comisionPorcentaje', {
            type: Sequelize.DECIMAL(5, 2),
            allowNull: true
        });

        await queryInterface.addIndex('viajes', ['comisionistaId'], {
            name: 'idx_viajes_comisionistaId'
        });
    },

    async down(queryInterface, _Sequelize) {
        await queryInterface.removeIndex('viajes', 'idx_viajes_comisionistaId');
        await queryInterface.removeColumn('viajes', 'comisionPorcentaje');
        await queryInterface.removeColumn('viajes', 'comisionistaId');
        await queryInterface.dropTable('comisionistas');
    }
};

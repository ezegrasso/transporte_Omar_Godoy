'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.changeColumn('adelantos', 'monto', {
            type: Sequelize.DECIMAL(15, 2),
            allowNull: false
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.changeColumn('adelantos', 'monto', {
            type: Sequelize.DECIMAL(10, 2),
            allowNull: false
        });
    }
};

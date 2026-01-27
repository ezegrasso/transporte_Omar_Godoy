'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('viajes', 'facturaBlob', {
      type: Sequelize.BLOB('long'),
      allowNull: true
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('viajes', 'facturaBlob');
  }
};

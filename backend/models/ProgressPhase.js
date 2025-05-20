const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProgressPhase = sequelize.define('ProgressPhase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: false,
      fields: ['display_order']
    }
  ]
});

module.exports = ProgressPhase;
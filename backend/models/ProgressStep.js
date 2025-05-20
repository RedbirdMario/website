const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProgressStep = sequelize.define('ProgressStep', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  phase_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'progress_phases',
      key: 'id'
    }
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
  },
  estimated_days: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: false,
      fields: ['phase_id']
    },
    {
      unique: false,
      fields: ['display_order']
    }
  ]
});

module.exports = ProgressStep;
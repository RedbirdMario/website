const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClientProgress = sequelize.define('ClientProgress', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  client_property_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'client_properties',
      key: 'id'
    }
  },
  step_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'progress_steps',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'in_progress', 'completed', 'delayed'),
    defaultValue: 'pending',
    allowNull: false
  },
  completion_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: true,
      fields: ['client_property_id', 'step_id']
    }
  ]
});

module.exports = ClientProgress;
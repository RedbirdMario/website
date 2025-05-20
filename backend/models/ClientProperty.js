const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClientProperty = sequelize.define('ClientProperty', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  client_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'clients',
      key: 'id'
    }
  },
  property_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'properties',
      key: 'id'
    }
  },
  purchase_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'EUR',
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('inquiry', 'negotiation', 'contracted', 'completed'),
    defaultValue: 'inquiry',
    allowNull: false
  },
  overall_progress: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    allowNull: false,
    validate: {
      min: 0,
      max: 100
    }
  },
  current_phase: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: true,
      fields: ['client_id', 'property_id']
    }
  ]
});

module.exports = ClientProperty;
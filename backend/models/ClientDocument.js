const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ClientDocument = sequelize.define('ClientDocument', {
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
  document_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'documents',
      key: 'id'
    }
  },
  property_id: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'properties',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending_review', 'approved', 'rejected', 'needs_signature'),
    defaultValue: 'pending_review',
    allowNull: false
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
      fields: ['client_id', 'document_id', 'property_id']
    }
  ]
});

module.exports = ClientDocument;
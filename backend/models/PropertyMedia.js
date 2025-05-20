const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PropertyMedia = sequelize.define('PropertyMedia', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  property_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'properties',
      key: 'id'
    }
  },
  media_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'media',
      key: 'id'
    }
  },
  display_order: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  is_featured: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: true,
      fields: ['property_id', 'media_id']
    },
    {
      unique: false,
      fields: ['display_order']
    },
    {
      unique: false,
      fields: ['is_featured']
    }
  ]
});

module.exports = PropertyMedia;
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Property = sequelize.define('Property', {
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
  unit_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING,
    defaultValue: 'EUR',
    allowNull: false
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  bathrooms: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  area_size: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  area_unit: {
    type: DataTypes.STRING,
    defaultValue: 'm²',
    allowNull: true
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('available', 'reserved', 'sold'),
    defaultValue: 'available',
    allowNull: false
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true // Soft delete
});

module.exports = Property;
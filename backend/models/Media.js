const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  file_path: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  file_size: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  file_type: {
    type: DataTypes.STRING,
    allowNull: true
  },
  media_type: {
    type: DataTypes.ENUM('image', 'video'),
    allowNull: false
  },
  category: {
    type: DataTypes.ENUM('exterior', 'interior', 'amenities', 'area'),
    allowNull: true
  },
  dimensions: {
    type: DataTypes.JSON,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER, // Duration in seconds
    allowNull: true
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: false,
      fields: ['uploaded_by']
    },
    {
      unique: false,
      fields: ['media_type']
    },
    {
      unique: false,
      fields: ['category']
    }
  ]
});

module.exports = Media;
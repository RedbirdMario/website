const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Document = sequelize.define('Document', {
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
  document_type: {
    type: DataTypes.ENUM('contract', 'legal', 'financial', 'technical'),
    allowNull: true
  },
  category: {
    type: DataTypes.STRING,
    allowNull: true
  },
  uploaded_by: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  is_template: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  version: {
    type: DataTypes.STRING,
    allowNull: true
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
      fields: ['document_type']
    }
  ]
});

module.exports = Document;
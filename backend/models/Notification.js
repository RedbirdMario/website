const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('info', 'warning', 'success', 'danger'),
    defaultValue: 'info',
    allowNull: false
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  action_url: {
    type: DataTypes.STRING,
    allowNull: true
  },
  read_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: false,
      fields: ['user_id']
    },
    {
      unique: false,
      fields: ['is_read']
    },
    {
      unique: false,
      fields: ['type']
    }
  ]
});

module.exports = Notification;
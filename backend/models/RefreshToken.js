const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefreshToken = sequelize.define('RefreshToken', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  is_revoked: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  timestamps: true,
  underscored: true,
  paranoid: true, // Soft delete
  indexes: [
    {
      unique: true,
      fields: ['token']
    },
    {
      fields: ['user_id']
    },
    {
      fields: ['expires_at']
    }
  ]
});

// Check if token is expired
RefreshToken.prototype.isExpired = function() {
  return new Date() > this.expires_at;
};

// Check if token is valid (not expired and not revoked)
RefreshToken.prototype.isValid = function() {
  return !this.is_revoked && !this.isExpired();
};

module.exports = RefreshToken;
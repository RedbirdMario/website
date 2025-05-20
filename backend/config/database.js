const { Sequelize } = require('sequelize');
require('dotenv').config();
const path = require('path');
const logger = require('../utils/logger');

// Create Sequelize instance
let sequelize;

// Use SQLite for development if SKIP_DB_CHECK is true
if (process.env.NODE_ENV === 'development' && process.env.SKIP_DB_CHECK === 'true') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../database.sqlite'),
    logging: console.log
  });
  logger.log('Using SQLite database for development');
} else {
  // Default PostgreSQL configuration
  sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

module.exports = { sequelize, Sequelize };
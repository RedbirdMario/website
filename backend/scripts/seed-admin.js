require('dotenv').config();
const { sequelize } = require('../config/database');
const { User } = require('../models');
const logger = require('./utils/logger');

async function seedAdmin() {
  try {
    logger.log('Checking database connection...');
    await sequelize.authenticate();
    logger.log('Database connection OK');
    
    // Sync models
    await sequelize.sync({ alter: true, force: process.env.NODE_ENV === 'development' });
    
    // Check if admin user exists
    const existingAdmin = await User.findOne({
      where: { email: 'admin@redbird.com' }
    });
    
    if (existingAdmin) {
      logger.log('Admin user already exists.');
      return;
    }
    
    // Create admin user
    const admin = await User.create({
      email: 'admin@redbird.com',
      password_hash: 'AdminPassword123!', // Will be hashed by the model hook
      first_name: 'Admin',
      last_name: 'User',
      role: 'admin',
      is_active: true
    });
    
    logger.log('Admin user created successfully:', {
      id: admin.id,
      email: admin.email,
      role: admin.role
    });
    
  } catch (error) {
    logger.error('Error seeding admin user:', error);
  } finally {
    await sequelize.close();
  }
}

seedAdmin();
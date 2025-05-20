require('dotenv').config();
const { sequelize } = require('../config/database');
const { User, Client } = require('../models');
const logger = require('./utils/logger');

async function seedDemoData() {
  try {
    logger.log('Checking database connection...');
    await sequelize.authenticate();
    logger.log('Database connection OK');
    
    // Sync models
    await sequelize.sync({ alter: true });
    
    // Create advisor user
    const advisor = await User.findOrCreate({
      where: { email: 'advisor@redbird.com' },
      defaults: {
        password_hash: 'AdvisorPassword123!',
        first_name: 'John',
        last_name: 'Advisor',
        role: 'advisor',
        phone: '+1234567890',
        avatar_url: '/img/avatars/advisor1.jpg',
        is_active: true
      }
    });
    
    // Create client user
    const client = await User.findOrCreate({
      where: { email: 'client@example.com' },
      defaults: {
        password_hash: 'ClientPassword123!',
        first_name: 'Jane',
        last_name: 'Client',
        role: 'client',
        phone: '+0987654321',
        is_active: true
      }
    });
    
    // Only create client record if it doesn't exist
    if (client[1]) { // If created (not found)
      await Client.create({
        user_id: client[0].id,
        advisor_id: advisor[0].id,
        notes: 'Demo client for testing purposes',
        special_requirements: 'Interested in beachfront properties'
      });
    }
    
    // Create another client
    const client2 = await User.findOrCreate({
      where: { email: 'client2@example.com' },
      defaults: {
        password_hash: 'ClientPassword123!',
        first_name: 'Robert',
        last_name: 'Smith',
        role: 'client',
        phone: '+1122334455',
        is_active: true
      }
    });
    
    // Only create client record if it doesn't exist
    if (client2[1]) { // If created (not found)
      await Client.create({
        user_id: client2[0].id,
        advisor_id: advisor[0].id,
        notes: 'High-value investor',
        special_requirements: 'Looking for investment properties'
      });
    }
    
    logger.log('Demo data seeded successfully!');
    
  } catch (error) {
    logger.error('Error seeding demo data:', error);
  } finally {
    await sequelize.close();
  }
}

seedDemoData();
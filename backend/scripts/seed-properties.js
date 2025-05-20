require('dotenv').config();
const { sequelize } = require('../config/database');
const { User, Client, Property, ClientProperty } = require('../models');
const logger = require('./utils/logger');

async function seedProperties() {
  try {
    logger.log('Checking database connection...');
    await sequelize.authenticate();
    logger.log('Database connection OK');
    
    // Sync models
    await sequelize.sync({ alter: true });
    
    // Check if we already have properties
    const propertyCount = await Property.count();
    
    if (propertyCount > 0) {
      logger.log(`${propertyCount} properties already exist. Skipping property seeding.`);
      return;
    }
    
    // Create sample properties
    const properties = await Property.bulkCreate([
      {
        name: 'Villa Serenity',
        description: 'Luxurious villa with panoramic sea views in Kyrenia',
        unit_number: 'VS-101',
        location: 'Kyrenia, North Cyprus',
        price: 375000,
        currency: 'EUR',
        bedrooms: 3,
        bathrooms: 2,
        area_size: 220,
        area_unit: 'm²',
        features: {
          pool: true,
          garden: true,
          parking: 2,
          security: true,
          sea_view: true
        },
        status: 'available'
      },
      {
        name: 'Azure Apartment',
        description: 'Modern beachfront apartment in Famagusta',
        unit_number: 'AA-205',
        location: 'Famagusta, North Cyprus',
        price: 185000,
        currency: 'EUR',
        bedrooms: 2,
        bathrooms: 1,
        area_size: 120,
        area_unit: 'm²',
        features: {
          pool: true,
          garden: false,
          parking: 1,
          security: true,
          sea_view: true
        },
        status: 'reserved'
      },
      {
        name: 'Mountain Retreat',
        description: 'Peaceful mountain villa with private garden',
        unit_number: 'MR-303',
        location: 'Bellapais, North Cyprus',
        price: 450000,
        currency: 'EUR',
        bedrooms: 4,
        bathrooms: 3,
        area_size: 320,
        area_unit: 'm²',
        features: {
          pool: true,
          garden: true,
          parking: 3,
          security: true,
          mountain_view: true
        },
        status: 'available'
      }
    ]);
    
    logger.log('Properties created successfully:', properties.map(p => p.name));
    
    // Find a client to assign properties
    const client = await Client.findOne({
      where: { user_id: (await User.findOne({ where: { email: 'client@example.com' } }))?.id }
    });
    
    if (client) {
      // Assign first property to client
      await ClientProperty.create({
        client_id: client.id,
        property_id: properties[0].id,
        status: 'contracted',
        overall_progress: 65,
        current_phase: 'Construction'
      });
      
      logger.log(`Assigned property '${properties[0].name}' to client`);
    }
    
  } catch (error) {
    logger.error('Error seeding properties:', error);
  } finally {
    await sequelize.close();
  }
}

seedProperties();
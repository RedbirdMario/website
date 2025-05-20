require('dotenv').config();
const { sequelize } = require('../config/database');
const { exec } = require('child_process');
const path = require('path');
const logger = require('./utils/logger');

async function seedAll() {
  try {
    logger.log('Checking database connection...');
    await sequelize.authenticate();
    logger.log('Database connection OK');
    
    // Sync models
    logger.log('Syncing database models...');
    await sequelize.sync({ alter: true, force: process.env.NODE_ENV === 'development' });
    
    // Close the connection to avoid interference with the child processes
    await sequelize.close();
    
    // Run seed scripts in sequence
    const scriptsToRun = [
      'seed-admin.js',
      'seed-properties.js',
      'seed-demo-data.js'
    ];
    
    for (const script of scriptsToRun) {
      logger.log(`\n=== Running ${script} ===\n`);
      await new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, script);
        exec(`node ${scriptPath}`, (error, stdout, stderr) => {
          if (error) {
            logger.error(`Error executing ${script}:`, error);
            return reject(error);
          }
          
          logger.log(stdout);
          if (stderr) logger.error(stderr);
          resolve();
        });
      });
    }
    
    logger.log('\n=== All seed scripts completed successfully ===\n');
    
  } catch (error) {
    logger.error('Error in seed-all script:', error);
    process.exit(1);
  }
}

seedAll();
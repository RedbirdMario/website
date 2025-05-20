require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./config/database');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 3000;

// Check database connection
async function assertDatabaseConnection() {
  try {
    await sequelize.authenticate();
    logger.log('Database connection established successfully.');
    
    // Sync models with database (in development)
    if (process.env.NODE_ENV === 'development') {
      await sequelize.sync({ alter: true });
      logger.log('Database models synchronized.');
    }
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
}

async function startServer() {
  // In development, we'll skip the database connection check for now
  // since we're just setting up the structure
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_DB_CHECK === 'true') {
    logger.log('Skipping database connection check...');
  } else {
    await assertDatabaseConnection();
  }
  
  app.listen(PORT, () => {
    logger.log(`Server running on port ${PORT}`);
    logger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(err => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
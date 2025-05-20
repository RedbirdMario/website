import logger from './logger.js';
// Global error handler middleware
exports.errorHandler = (err, req, res, next) => {
  logger.error('Error:', err);
  
  // Sequelize validation errors
  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    const errors = err.errors.map(e => ({
      field: e.path,
      message: e.message
    }));
    
    return res.status(422).json({
      error: true,
      message: 'Validation failed',
      details: errors
    });
  }
  
  // JWT errors are handled in auth middleware
  
  // Default error response
  res.status(err.statusCode || 500).json({
    error: true,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
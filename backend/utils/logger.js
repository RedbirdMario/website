import logger from './logger.js';
/**
 * Centralized logger for RedBird backend
 * Provides consistent logging across the application
 */

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Logger utility for backend services
 */
const logger = {
  /**
   * Log informational message (disabled in production)
   * @param {string} message - The message to log
   * @param {...any} args - Additional arguments to log
   */
  log(message, ...args) {
    if (!isProduction) {
      logger.log(message, ...args);
    }
  },

  /**
   * Log warning message (only in non-production or if forced)
   * @param {string} message - The warning message to log
   * @param {...any} args - Additional arguments to log
   */
  warn(message, ...args) {
    if (!isProduction) {
      logger.warn(message, ...args);
    }
  },

  /**
   * Log error message (always logged)
   * @param {string} message - The error message to log
   * @param {...any} args - Additional arguments to log
   */
  error(message, ...args) {
    // Errors are always logged
    logger.error(message, ...args);
  },

  /**
   * Log debug information (only in development)
   * @param {string} message - The debug message to log
   * @param {...any} args - Additional arguments to log
   */
  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(message, ...args);
    }
  },

  /**
   * Log information about an HTTP request (in non-production)
   * @param {object} req - Express request object
   * @param {string} context - Additional context information
   */
  request(req, context = '') {
    if (!isProduction) {
      logger.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${context}`);
    }
  }
};

module.exports = logger;
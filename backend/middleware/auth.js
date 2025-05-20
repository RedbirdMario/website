const jwt = require('jsonwebtoken');
const { User } = require('../models');

// Verify JWT token middleware
exports.protect = async (req, res, next) => {
  try {
    let token;
    
    // Get token from Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if token exists
    if (!token) {
      return res.status(401).json({
        error: true,
        message: 'Not authenticated. Please log in to access this resource'
      });
    }
    
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user by ID
    const user = await User.findByPk(decoded.id);
    
    // Check if user exists
    if (!user) {
      return res.status(401).json({
        error: true,
        message: 'The user belonging to this token no longer exists'
      });
    }
    
    // Check if user is active
    if (!user.is_active) {
      return res.status(401).json({
        error: true,
        message: 'Your account has been deactivated. Please contact support'
      });
    }
    
    // Set user in request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        error: true,
        message: 'Invalid token. Please log in again'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: true,
        message: 'Your session has expired. Please log in again',
        expired: true
      });
    }
    
    return res.status(500).json({
      error: true,
      message: 'Authentication error'
    });
  }
};

// Role-based authorization middleware
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: true,
        message: 'You do not have permission to perform this action'
      });
    }
    next();
  };
};
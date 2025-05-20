const { validationResult } = require('express-validator');
const authService = require('../services/authService');
const logger = require('../utils/logger');

// Login controller
exports.login = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { email, password, remember_me } = req.body;
    
    // Login user
    const authData = await authService.login(email, password, remember_me);
    
    // Return user and tokens
    res.status(200).json(authData);
  } catch (error) {
    res.status(401).json({
      error: true,
      message: error.message || 'Authentication failed'
    });
  }
};

// Refresh token controller
exports.refreshToken = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { refresh_token } = req.body;
    
    // Refresh token
    const authData = await authService.refreshToken(refresh_token);
    
    // Return new tokens
    res.status(200).json(authData);
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(401).json({
      error: true,
      message: error.message || 'Token refresh failed',
      expired: true
    });
  }
};

// Logout controller
exports.logout = async (req, res) => {
  try {
    // Get refresh token from request
    const { refresh_token } = req.body;
    
    // Revoke the refresh token if provided
    await authService.revokeRefreshToken(refresh_token);
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    logger.error('Logout error:', error);
    // Always return success for logout, even if there was an error
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};

// Get current user controller
exports.getMe = async (req, res) => {
  try {
    // Get user profile
    const userData = await authService.getUserProfile(req.user.id);
    
    // Return user data
    res.status(200).json(userData);
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message || 'Error fetching user data'
    });
  }
};

// Request password reset controller
exports.forgotPassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { email } = req.body;
    
    // Request password reset
    const result = await authService.requestPasswordReset(email);
    
    // Return result (includes token in development)
    res.status(200).json({
      success: true,
      message: 'Password reset instructions sent to your email',
      ...(process.env.NODE_ENV === 'development' && { resetToken: result.resetToken, resetURL: result.resetURL })
    });
  } catch (error) {
    res.status(500).json({
      error: true,
      message: error.message || 'Error requesting password reset'
    });
  }
};

// Reset password controller
exports.resetPassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { token, new_password } = req.body;
    
    // Reset password
    const authData = await authService.resetPassword(token, new_password);
    
    // Return user and tokens
    res.status(200).json(authData);
  } catch (error) {
    res.status(400).json({
      error: true,
      message: error.message || 'Error resetting password'
    });
  }
};

// Update password controller
exports.updatePassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { current_password, new_password } = req.body;
    
    // Update password
    const result = await authService.updatePassword(
      req.user.id,
      current_password,
      new_password
    );
    
    // Return new tokens
    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
      token: result.token,
      refresh_token: result.refresh_token
    });
  } catch (error) {
    res.status(400).json({
      error: true,
      message: error.message || 'Error updating password'
    });
  }
};
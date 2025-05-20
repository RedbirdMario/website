const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Login route
router.post(
  '/login',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
  ],
  authController.login
);

// Refresh token route
router.post(
  '/refresh',
  [
    body('refresh_token')
      .notEmpty()
      .withMessage('Refresh token is required')
  ],
  authController.refreshToken
);

// Logout route
router.post(
  '/logout', 
  protect, 
  [
    body('refresh_token')
      .optional()
  ],
  authController.logout
);

// Get current user route
router.get('/me', protect, authController.getMe);

// Forgot password route
router.post(
  '/forgot-password',
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address')
  ],
  authController.forgotPassword
);

// Reset password route
router.post(
  '/reset-password',
  [
    body('token')
      .notEmpty()
      .withMessage('Reset token is required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirm_password')
      .custom((value, { req }) => {
        if (value !== req.body.new_password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],
  authController.resetPassword
);

// Update password route
router.put(
  '/update-password',
  protect,
  [
    body('current_password')
      .notEmpty()
      .withMessage('Current password is required'),
    body('new_password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('confirm_password')
      .custom((value, { req }) => {
        if (value !== req.body.new_password) {
          throw new Error('Passwords do not match');
        }
        return true;
      })
  ],
  authController.updatePassword
);

module.exports = router;
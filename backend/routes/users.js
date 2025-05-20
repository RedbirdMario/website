const express = require('express');
const { body } = require('express-validator');
const userController = require('../controllers/userController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// User CRUD routes
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);

// Admin-only user creation route
router.post(
  '/',
  restrictTo('admin'),
  [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('first_name')
      .notEmpty()
      .withMessage('First name is required'),
    body('last_name')
      .notEmpty()
      .withMessage('Last name is required'),
    body('role')
      .optional()
      .isIn(['admin', 'advisor', 'client'])
      .withMessage('Invalid role value')
  ],
  userController.createUser
);

// Update user route
router.put(
  '/:id',
  [
    body('email')
      .optional()
      .isEmail()
      .withMessage('Please provide a valid email address'),
    body('password')
      .optional()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]+$/)
      .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    body('role')
      .optional()
      .isIn(['admin', 'advisor', 'client'])
      .withMessage('Invalid role value')
  ],
  userController.updateUser
);

// Admin-only user deletion route
router.delete('/:id', restrictTo('admin'), userController.deleteUser);

// Get all advisors
router.get('/roles/advisors', userController.getAdvisors);

// Get advisor's clients
router.get('/advisors/:advisorId/clients', userController.getAdvisorClients);

// Assign client to advisor (admin only)
router.post(
  '/clients/assign',
  restrictTo('admin'),
  [
    body('client_id')
      .notEmpty()
      .withMessage('Client ID is required'),
    body('advisor_id')
      .optional()
      .withMessage('Advisor ID is required')
  ],
  userController.assignClientToAdvisor
);

module.exports = router;
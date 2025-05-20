const express = require('express');
const { body } = require('express-validator');
const propertyController = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Property CRUD routes
router.get('/', propertyController.getAllProperties);
router.get('/:id', propertyController.getPropertyById);

// Admin-only routes
router.post(
  '/',
  restrictTo('admin'),
  [
    body('name').notEmpty().withMessage('Property name is required'),
    body('status').optional().isIn(['available', 'reserved', 'sold']).withMessage('Invalid status value')
  ],
  propertyController.createProperty
);

router.put(
  '/:id',
  restrictTo('admin'),
  [
    body('name').optional().notEmpty().withMessage('Property name cannot be empty'),
    body('status').optional().isIn(['available', 'reserved', 'sold']).withMessage('Invalid status value')
  ],
  propertyController.updateProperty
);

router.delete('/:id', restrictTo('admin'), propertyController.deleteProperty);

// Client-Property routes have been moved to their own router module

module.exports = router;
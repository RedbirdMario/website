const express = require('express');
const { body } = require('express-validator');
const propertyController = require('../controllers/propertyController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Client-Property routes
router.get('/', propertyController.getClientProperties);
router.get('/:id', propertyController.getClientPropertyById);

router.post(
  '/',
  restrictTo('admin', 'advisor'),
  [
    body('client_id').notEmpty().withMessage('Client ID is required'),
    body('property_id').notEmpty().withMessage('Property ID is required'),
    body('status').optional().isIn(['inquiry', 'negotiation', 'contracted', 'completed']).withMessage('Invalid status value')
  ],
  propertyController.assignProperty
);

router.put(
  '/:id',
  restrictTo('admin', 'advisor'),
  [
    body('status').optional().isIn(['inquiry', 'negotiation', 'contracted', 'completed']).withMessage('Invalid status value'),
    body('overall_progress').optional().isInt({ min: 0, max: 100 }).withMessage('Progress must be between 0 and 100')
  ],
  propertyController.updateAssignment
);

router.delete('/:id', restrictTo('admin', 'advisor'), propertyController.removeAssignment);

module.exports = router;
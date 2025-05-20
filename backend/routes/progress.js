const express = require('express');
const { body } = require('express-validator');
const progressController = require('../controllers/progressController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Progress Phases routes
router.get('/phases', progressController.getAllPhases);
router.get('/phases/:id', progressController.getPhaseById);

// Admin-only phase management routes
router.post(
  '/phases',
  restrictTo('admin'),
  [
    body('name').notEmpty().withMessage('Phase name is required'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a positive integer')
  ],
  progressController.createPhase
);

router.put(
  '/phases/:id',
  restrictTo('admin'),
  [
    body('name').optional().notEmpty().withMessage('Phase name cannot be empty'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a positive integer')
  ],
  progressController.updatePhase
);

router.delete('/phases/:id', restrictTo('admin'), progressController.deletePhase);

// Progress Steps routes
router.get('/steps', progressController.getAllSteps);
router.get('/steps/:id', progressController.getStepById);

// Admin-only step management routes
router.post(
  '/steps',
  restrictTo('admin'),
  [
    body('phase_id').notEmpty().withMessage('Phase ID is required'),
    body('name').notEmpty().withMessage('Step name is required'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a positive integer'),
    body('estimated_days').optional().isInt({ min: 0 }).withMessage('Estimated days must be a positive integer')
  ],
  progressController.createStep
);

router.put(
  '/steps/:id',
  restrictTo('admin'),
  [
    body('phase_id').optional().notEmpty().withMessage('Phase ID cannot be empty'),
    body('name').optional().notEmpty().withMessage('Step name cannot be empty'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a positive integer'),
    body('estimated_days').optional().isInt({ min: 0 }).withMessage('Estimated days must be a positive integer')
  ],
  progressController.updateStep
);

router.delete('/steps/:id', restrictTo('admin'), progressController.deleteStep);

// Client Progress routes
router.get('/client-progress', progressController.getClientProgress);
router.get('/clients/:client_id/properties/:property_id/progress', progressController.getClientPropertyProgress);

router.post(
  '/client-progress',
  restrictTo('admin', 'advisor'),
  [
    body('client_property_id').notEmpty().withMessage('Client property ID is required'),
    body('step_id').notEmpty().withMessage('Step ID is required'),
    body('status').isIn(['pending', 'in_progress', 'completed', 'delayed']).withMessage('Invalid status value')
  ],
  progressController.updateClientProgress
);

router.put('/client-progress/:id', restrictTo('admin', 'advisor'), [
  body('status').isIn(['pending', 'in_progress', 'completed', 'delayed']).withMessage('Invalid status value')
], progressController.updateClientProgressById);

router.delete('/client-progress/:id', restrictTo('admin', 'advisor'), progressController.deleteClientProgress);

module.exports = router;
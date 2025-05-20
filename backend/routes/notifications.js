const express = require('express');
const { body } = require('express-validator');
const notificationController = require('../controllers/notificationController');
const { protect, restrictTo } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Notification routes
router.get('/', notificationController.getUserNotifications);
router.get('/:id', notificationController.getNotificationById);

// Create notification (admin/advisor only)
router.post(
  '/',
  restrictTo('admin', 'advisor'),
  [
    body('user_id')
      .notEmpty()
      .withMessage('User ID is required'),
    body('title')
      .notEmpty()
      .withMessage('Notification title is required'),
    body('message')
      .notEmpty()
      .withMessage('Notification message is required'),
    body('type')
      .optional()
      .isIn(['info', 'warning', 'success', 'danger'])
      .withMessage('Invalid notification type')
  ],
  notificationController.createNotification
);

// Mark notification as read
router.put('/:id/read', notificationController.markAsRead);

// Mark all notifications as read
router.put('/read-all', notificationController.markAllAsRead);

// Delete notification
router.delete('/:id', notificationController.deleteNotification);

// Delete all read notifications
router.delete('/read/all', notificationController.deleteAllRead);

// Send bulk notifications (admin/advisor only)
router.post(
  '/bulk',
  restrictTo('admin', 'advisor'),
  [
    body('user_ids')
      .isArray()
      .withMessage('User IDs must be an array')
      .notEmpty()
      .withMessage('User IDs array cannot be empty'),
    body('title')
      .notEmpty()
      .withMessage('Notification title is required'),
    body('message')
      .notEmpty()
      .withMessage('Notification message is required'),
    body('type')
      .optional()
      .isIn(['info', 'warning', 'success', 'danger'])
      .withMessage('Invalid notification type')
  ],
  notificationController.sendBulkNotifications
);

module.exports = router;
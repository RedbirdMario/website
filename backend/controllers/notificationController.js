const { Notification, User } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const logger = require('./utils/logger');

// Get user notifications
exports.getUserNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 10, is_read } = req.query;
    const offset = (page - 1) * limit;
    
    // Users can only see their own notifications
    const whereConditions = { user_id: req.user.id };
    
    // Filter by read status if provided
    if (is_read !== undefined) {
      whereConditions.is_read = is_read === 'true';
    }
    
    // Execute query
    const { count, rows: notifications } = await Notification.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    // Return paginated results
    res.status(200).json({
      notifications,
      total: count,
      unread_count: await Notification.count({
        where: {
          user_id: req.user.id,
          is_read: false
        }
      }),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching notifications'
    });
  }
};

// Get notification by ID
exports.getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findByPk(id);
    
    if (!notification) {
      return res.status(404).json({
        error: true,
        message: 'Notification not found'
      });
    }
    
    // Users can only see their own notifications
    if (notification.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    res.status(200).json(notification);
  } catch (error) {
    logger.error('Error fetching notification:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching notification'
    });
  }
};

// Create notification
exports.createNotification = async (req, res) => {
  try {
    // Only admins and advisors can create notifications
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can create notifications'
      });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { user_id, title, message, type, action_url } = req.body;
    
    // Verify user exists
    const user = await User.findByPk(user_id);
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }
    
    // Create notification
    const notification = await Notification.create({
      user_id,
      title,
      message,
      type: type || 'info',
      action_url,
      is_read: false
    });
    
    res.status(201).json(notification);
  } catch (error) {
    logger.error('Error creating notification:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(422).json({
        error: true,
        message: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }
    
    res.status(500).json({
      error: true,
      message: 'Error creating notification'
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findByPk(id);
    
    if (!notification) {
      return res.status(404).json({
        error: true,
        message: 'Notification not found'
      });
    }
    
    // Users can only update their own notifications
    if (notification.user_id !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Update notification
    await notification.update({
      is_read: true,
      read_at: new Date()
    });
    
    res.status(200).json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error updating notification:', error);
    res.status(500).json({
      error: true,
      message: 'Error updating notification'
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    // Update all unread notifications for the user
    await Notification.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          user_id: req.user.id,
          is_read: false
        }
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error updating notifications:', error);
    res.status(500).json({
      error: true,
      message: 'Error updating notifications'
    });
  }
};

// Delete notification
exports.deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    
    const notification = await Notification.findByPk(id);
    
    if (!notification) {
      return res.status(404).json({
        error: true,
        message: 'Notification not found'
      });
    }
    
    // Users can delete their own notifications, admins can delete any
    if (notification.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Delete notification
    await notification.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting notification'
    });
  }
};

// Delete all read notifications
exports.deleteAllRead = async (req, res) => {
  try {
    // Delete all read notifications for the user
    await Notification.destroy({
      where: {
        user_id: req.user.id,
        is_read: true
      }
    });
    
    res.status(200).json({
      success: true,
      message: 'All read notifications deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting notifications:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting notifications'
    });
  }
};

// Send notification to multiple users
exports.sendBulkNotifications = async (req, res) => {
  try {
    // Only admins and advisors can send bulk notifications
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can send bulk notifications'
      });
    }
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    const { user_ids, title, message, type, action_url } = req.body;
    
    // Verify users exist
    const users = await User.findAll({
      where: { id: { [Op.in]: user_ids } }
    });
    
    if (users.length !== user_ids.length) {
      return res.status(404).json({
        error: true,
        message: 'One or more users not found'
      });
    }
    
    // Create notifications
    const notifications = await Promise.all(
      user_ids.map(userId => 
        Notification.create({
          user_id: userId,
          title,
          message,
          type: type || 'info',
          action_url,
          is_read: false
        })
      )
    );
    
    res.status(201).json({
      success: true,
      message: `${notifications.length} notifications created successfully`,
      count: notifications.length
    });
  } catch (error) {
    logger.error('Error creating bulk notifications:', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(422).json({
        error: true,
        message: 'Validation error',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }
    
    res.status(500).json({
      error: true,
      message: 'Error creating bulk notifications'
    });
  }
};
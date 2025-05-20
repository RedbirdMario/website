/**
 * Contact Form Controller
 * Handles contact form submissions and queries
 */
const { validationResult } = require('express-validator');
const mongoose = require('mongoose');
const ContactForm = require('../models/ContactForm');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

/**
 * Submit a new contact form
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response
 */
exports.submitContactForm = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: true,
        message: 'Validation failed',
        details: errors.array()
      });
    }

    // Extract form data
    const { name, email, phone, subject, message } = req.body;

    // Create contact submission in database
    const contactSubmission = new ContactForm({
      name,
      email,
      phone: phone || null,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Save to database
    const savedSubmission = await contactSubmission.save();

    // Send confirmation email to user
    try {
      await emailService.sendContactConfirmation(email, name);
    } catch (emailError) {
      // Log email error but don't fail the request
      logger.error('Failed to send confirmation email:', emailError);
    }

    // Send notification email to admin
    try {
      const adminEmail = process.env.ADMIN_EMAIL || 'info@redbird-realestate.com';
      await emailService.sendContactNotification(adminEmail, {
        name,
        email,
        phone: phone || 'Not provided',
        subject,
        message
      });
    } catch (emailError) {
      // Log email error but don't fail the request
      logger.error('Failed to send admin notification email:', emailError);
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Contact form submitted successfully',
      data: {
        id: savedSubmission._id,
        timestamp: savedSubmission.createdAt
      }
    });
  } catch (error) {
    logger.error('Error submitting contact form:', error);
    return res.status(500).json({
      error: true,
      message: 'An error occurred while submitting the contact form'
    });
  }
};

/**
 * Get all contact form submissions (admin only)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} - JSON response with contact submissions
 */
exports.getContactSubmissions = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Access denied: Admin privileges required'
      });
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Build query
    const query = {};
    
    // Optional date filtering
    if (req.query.startDate && req.query.endDate) {
      query.createdAt = {
        $gte: new Date(req.query.startDate),
        $lte: new Date(req.query.endDate)
      };
    }

    // Execute query with pagination
    const submissions = await ContactForm.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Get total count for pagination
    const totalCount = await ContactForm.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        submissions,
        pagination: {
          total: totalCount,
          page,
          limit,
          pages: Math.ceil(totalCount / limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching contact submissions:', error);
    return res.status(500).json({
      error: true,
      message: 'An error occurred while fetching contact submissions'
    });
  }
};
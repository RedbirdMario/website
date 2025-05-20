/**
 * Contact Form Routes
 * Handles public contact form submissions
 */
const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { submitContactForm, getContactSubmissions } = require('../controllers/contactController');
const { auth } = require('../middleware/auth');

// Rate limiting middleware - to prevent form spam
const contactFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: true,
    message: 'Too many contact form submissions, please try again after an hour'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Form validation middleware
const validateContactForm = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  
  body('email')
    .trim()
    .isEmail()
    .withMessage('A valid email address is required')
    .normalizeEmail(),
  
  body('phone')
    .optional()
    .trim()
    .matches(/^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,4}[-\s.]?[0-9]{1,9}$/)
    .withMessage('Please provide a valid phone number'),
  
  body('subject')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Subject must be between 2 and 100 characters'),
  
  body('message')
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage('Message must be between 10 and 2000 characters'),
  
  // Honeypot field to catch bots
  body('website')
    .isEmpty()
    .withMessage('Honeypot field must be empty')
];

/**
 * @route   POST /api/v1/contact/submit
 * @desc    Submit a contact form
 * @access  Public
 */
router.post('/submit', contactFormLimiter, validateContactForm, submitContactForm);

/**
 * @route   GET /api/v1/contact
 * @desc    Get all contact form submissions (admin only)
 * @access  Private (Admin)
 */
router.get('/', auth, getContactSubmissions);

module.exports = router;
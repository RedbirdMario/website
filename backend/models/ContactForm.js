/**
 * ContactForm Model
 * Stores contact form submissions from website visitors
 */
const mongoose = require('mongoose');

const ContactFormSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true,
    default: null
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    enum: ['new', 'read', 'responded', 'archived'],
    default: 'new'
  },
  ipAddress: {
    type: String,
    default: null
  },
  userAgent: {
    type: String,
    default: null
  },
  notes: {
    type: String,
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Create indexes for common queries
ContactFormSchema.index({ email: 1 });
ContactFormSchema.index({ status: 1 });
ContactFormSchema.index({ createdAt: -1 });

module.exports = mongoose.model('ContactForm', mongoose.models.ContactForm || 'ContactForm', ContactFormSchema);
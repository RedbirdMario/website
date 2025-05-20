const express = require('express');
const { body } = require('express-validator');
const documentController = require('../controllers/documentController');
const { protect, restrictTo } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'documents');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate a unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const fileExt = path.extname(file.originalname);
    cb(null, 'doc-' + uniqueSuffix + fileExt);
  }
});

// Configure file filter
const fileFilter = (req, file, cb) => {
  // Accept common document file types
  const allowedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'image/jpeg',
    'image/png',
    'image/gif'
  ];
  
  if (allowedFileTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

// Initialize multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

const router = express.Router();

// All routes require authentication
router.use(protect);

// Document CRUD routes
router.get('/', documentController.getAllDocuments);
router.get('/:id', documentController.getDocumentById);

// Upload document route
router.post(
  '/',
  upload.single('document'),
  [
    body('title').notEmpty().withMessage('Document title is required'),
    body('document_type').optional().isIn(['contract', 'legal', 'financial', 'technical']).withMessage('Invalid document type'),
    body('is_template').optional().isBoolean().withMessage('is_template must be a boolean')
  ],
  documentController.uploadDocument
);

// Update document route
router.put(
  '/:id',
  [
    body('title').optional().notEmpty().withMessage('Document title cannot be empty'),
    body('document_type').optional().isIn(['contract', 'legal', 'financial', 'technical']).withMessage('Invalid document type'),
    body('is_template').optional().isBoolean().withMessage('is_template must be a boolean')
  ],
  documentController.updateDocument
);

// Delete document route
router.delete('/:id', documentController.deleteDocument);

// Client-Document assignment routes
router.get('/client-documents', documentController.getClientDocuments);

router.post(
  '/client-documents',
  restrictTo('admin', 'advisor'),
  [
    body('client_id').notEmpty().withMessage('Client ID is required'),
    body('document_id').notEmpty().withMessage('Document ID is required'),
    body('status').optional().isIn(['pending_review', 'approved', 'rejected', 'needs_signature']).withMessage('Invalid status value')
  ],
  documentController.assignDocument
);

router.put(
  '/client-documents/:id',
  restrictTo('admin', 'advisor'),
  [
    body('status').optional().isIn(['pending_review', 'approved', 'rejected', 'needs_signature']).withMessage('Invalid status value')
  ],
  documentController.updateAssignment
);

router.delete('/client-documents/:id', restrictTo('admin', 'advisor'), documentController.removeAssignment);

module.exports = router;
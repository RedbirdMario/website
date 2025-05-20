const express = require('express');
const { body } = require('express-validator');
const mediaController = require('../controllers/mediaController');
const { protect, restrictTo } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const logger = require('./utils/logger');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'images');
    
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
    cb(null, 'media-' + uniqueSuffix + fileExt);
  }
});

// Configure file filter
const fileFilter = (req, file, cb) => {
  // Accept common image/video file types
  const allowedFileTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/mpeg',
    'video/quicktime'
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
    fileSize: 15 * 1024 * 1024 // 15MB limit
  }
});

// Middleware to get image dimensions
const processImage = async (req, res, next) => {
  try {
    if (!req.file || !req.file.mimetype.startsWith('image/')) {
      return next();
    }
    
    // Get image dimensions
    const metadata = await sharp(req.file.path).metadata();
    req.imageSize = {
      width: metadata.width,
      height: metadata.height
    };
    
    next();
  } catch (error) {
    logger.error('Error processing image:', error);
    next();
  }
};

const router = express.Router();

// All routes require authentication
router.use(protect);

// Media CRUD routes
router.get('/', mediaController.getAllMedia);
router.get('/:id', mediaController.getMediaById);

// Upload media route
router.post(
  '/',
  upload.single('media'),
  processImage,
  [
    body('title').notEmpty().withMessage('Media title is required'),
    body('media_type').optional().isIn(['image', 'video']).withMessage('Invalid media type'),
    body('category').optional().isIn(['exterior', 'interior', 'amenities', 'area']).withMessage('Invalid category')
  ],
  mediaController.uploadMedia
);

// Update media route
router.put(
  '/:id',
  [
    body('title').optional().notEmpty().withMessage('Media title cannot be empty'),
    body('media_type').optional().isIn(['image', 'video']).withMessage('Invalid media type'),
    body('category').optional().isIn(['exterior', 'interior', 'amenities', 'area']).withMessage('Invalid category')
  ],
  mediaController.updateMedia
);

// Delete media route
router.delete('/:id', mediaController.deleteMedia);

// Property-Media assignment routes
router.get('/property-media', mediaController.getPropertyMedia);

router.post(
  '/property-media',
  restrictTo('admin', 'advisor'),
  [
    body('property_id').notEmpty().withMessage('Property ID is required'),
    body('media_id').notEmpty().withMessage('Media ID is required'),
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a positive integer'),
    body('is_featured').optional().isBoolean().withMessage('is_featured must be a boolean')
  ],
  mediaController.assignMedia
);

router.put(
  '/property-media/:id',
  restrictTo('admin', 'advisor'),
  [
    body('display_order').optional().isInt({ min: 0 }).withMessage('Display order must be a positive integer'),
    body('is_featured').optional().isBoolean().withMessage('is_featured must be a boolean')
  ],
  mediaController.updateAssignment
);

router.delete('/property-media/:id', restrictTo('admin', 'advisor'), mediaController.removeAssignment);

module.exports = router;
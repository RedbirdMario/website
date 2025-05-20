const { Media, PropertyMedia, Property, Client, User, ClientProperty } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Get all media
exports.getAllMedia = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, media_type, category } = req.query;
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const whereConditions = {};
    if (search) {
      whereConditions[Op.or] = [
        { title: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
        { file_name: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (media_type) {
      whereConditions.media_type = media_type;
    }
    
    if (category) {
      whereConditions.category = category;
    }
    
    // Access control based on user role
    if (req.user.role === 'client') {
      // Get the client's ID
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client) {
        return res.status(403).json({
          error: true,
          message: 'Client profile not found'
        });
      }
      
      // Get client's properties
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: client.id },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      // Get media associated with client's properties
      const propertyMedia = await PropertyMedia.findAll({
        where: { property_id: { [Op.in]: propertyIds } },
        attributes: ['media_id']
      });
      
      const mediaIds = propertyMedia.map(pm => pm.media_id);
      
      // Client can only see media associated with their properties
      whereConditions.id = { [Op.in]: mediaIds };
    }
    
    // Advisors can see media for their clients' properties
    if (req.user.role === 'advisor') {
      // Get advisor's clients
      const clients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = clients.map(client => client.id);
      
      // Get properties assigned to these clients
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: { [Op.in]: clientIds } },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      // Get media associated with these properties
      const propertyMedia = await PropertyMedia.findAll({
        where: { property_id: { [Op.in]: propertyIds } },
        attributes: ['media_id']
      });
      
      const mediaIds = propertyMedia.map(pm => pm.media_id);
      
      // Add advisor's uploaded media
      whereConditions[Op.or] = [
        { id: { [Op.in]: mediaIds } },
        { uploaded_by: req.user.id }
      ];
    }
    
    // Execute query
    const { count, rows: media } = await Media.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'first_name', 'last_name']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    // Return paginated results
    res.status(200).json({
      media,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Error fetching media:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching media'
    });
  }
};

// Get media by ID
exports.getMediaById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await Media.findByPk(id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });
    
    if (!media) {
      return res.status(404).json({
        error: true,
        message: 'Media not found'
      });
    }
    
    // Access control - clients can only see media for their properties
    if (req.user.role === 'client') {
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      // Get client's properties
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: client.id },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      // Check if this media is linked to client's properties
      const propertyMedia = await PropertyMedia.findOne({
        where: {
          property_id: { [Op.in]: propertyIds },
          media_id: id
        }
      });
      
      if (!propertyMedia) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Access control - advisors can only see their clients' media or media they uploaded
    if (req.user.role === 'advisor' && media.uploaded_by !== req.user.id) {
      // Get advisor's clients
      const clients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = clients.map(client => client.id);
      
      // Get properties assigned to these clients
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: { [Op.in]: clientIds } },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      // Check if this media is linked to advisor's clients' properties
      const propertyMedia = await PropertyMedia.findOne({
        where: {
          property_id: { [Op.in]: propertyIds },
          media_id: id
        }
      });
      
      if (!propertyMedia) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    res.status(200).json(media);
  } catch (error) {
    logger.error('Error fetching media:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching media'
    });
  }
};

// Upload media
exports.uploadMedia = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ 
        error: true, 
        message: 'Validation failed', 
        details: errors.array() 
      });
    }
    
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        error: true,
        message: 'No file uploaded'
      });
    }
    
    const { 
      title, 
      description, 
      media_type, 
      category
    } = req.body;
    
    // Determine dimensions for images
    let dimensions = null;
    if (req.file.mimetype.startsWith('image/') && req.imageSize) {
      dimensions = {
        width: req.imageSize.width,
        height: req.imageSize.height
      };
    }
    
    // Create media record
    const media = await Media.create({
      title,
      description,
      file_path: req.file.path,
      file_name: req.file.originalname,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      media_type: media_type || (req.file.mimetype.startsWith('image/') ? 'image' : 'video'),
      category,
      dimensions,
      duration: req.body.duration || null,
      uploaded_by: req.user.id
    });
    
    // Assign media to property if specified
    if (req.body.property_id) {
      // Verify property exists
      const property = await Property.findByPk(req.body.property_id);
      if (!property) {
        return res.status(404).json({
          error: true,
          message: 'Property not found'
        });
      }
      
      // Create property media association
      await PropertyMedia.create({
        property_id: req.body.property_id,
        media_id: media.id,
        display_order: req.body.display_order || 0,
        is_featured: req.body.is_featured === 'true'
      });
    }
    
    res.status(201).json(media);
  } catch (error) {
    logger.error('Error uploading media:', error);
    
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
      message: 'Error uploading media'
    });
  }
};

// Update media
exports.updateMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await Media.findByPk(id);
    
    if (!media) {
      return res.status(404).json({
        error: true,
        message: 'Media not found'
      });
    }
    
    // Check permissions: only uploader or admin can update
    if (req.user.role !== 'admin' && media.uploaded_by !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Update media
    await media.update(req.body);
    
    res.status(200).json(media);
  } catch (error) {
    logger.error('Error updating media:', error);
    
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
      message: 'Error updating media'
    });
  }
};

// Delete media
exports.deleteMedia = async (req, res) => {
  try {
    const { id } = req.params;
    
    const media = await Media.findByPk(id);
    
    if (!media) {
      return res.status(404).json({
        error: true,
        message: 'Media not found'
      });
    }
    
    // Check permissions: only uploader or admin can delete
    if (req.user.role !== 'admin' && media.uploaded_by !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Delete file from disk
    if (media.file_path && fs.existsSync(media.file_path)) {
      fs.unlinkSync(media.file_path);
    }
    
    // Delete property media associations
    await PropertyMedia.destroy({
      where: { media_id: id }
    });
    
    // Delete media record
    await media.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Media deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting media:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting media'
    });
  }
};

// Get property media
exports.getPropertyMedia = async (req, res) => {
  try {
    const { propertyId, is_featured } = req.query;
    
    // Build where conditions
    const whereConditions = {};
    
    if (propertyId) {
      whereConditions.property_id = propertyId;
    }
    
    if (is_featured !== undefined) {
      whereConditions.is_featured = is_featured === 'true';
    }
    
    // Access control
    // Clients can only see media for their properties
    if (req.user.role === 'client') {
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      // Get client's properties
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: client.id },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      if (propertyId && !propertyIds.includes(propertyId)) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      if (!propertyId) {
        whereConditions.property_id = { [Op.in]: propertyIds };
      }
    }
    
    // Advisors can only see media for their clients' properties
    if (req.user.role === 'advisor') {
      // Get advisor's clients
      const clients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = clients.map(client => client.id);
      
      // Get properties assigned to these clients
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: { [Op.in]: clientIds } },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      if (propertyId && !propertyIds.includes(propertyId)) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      if (!propertyId) {
        whereConditions.property_id = { [Op.in]: propertyIds };
      }
    }
    
    // Execute query
    const propertyMedia = await PropertyMedia.findAll({
      where: whereConditions,
      include: [
        {
          model: Media,
          as: 'media',
          include: [
            {
              model: User,
              as: 'uploader',
              attributes: ['id', 'first_name', 'last_name']
            }
          ]
        },
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'unit_number']
        }
      ],
      order: [['display_order', 'ASC']]
    });
    
    res.status(200).json(propertyMedia);
  } catch (error) {
    logger.error('Error fetching property media:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching property media'
    });
  }
};

// Assign media to property
exports.assignMedia = async (req, res) => {
  try {
    const { property_id, media_id, display_order, is_featured } = req.body;
    
    // Only admins and advisors can assign media
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can assign media'
      });
    }
    
    // Verify property exists
    const property = await Property.findByPk(property_id);
    if (!property) {
      return res.status(404).json({
        error: true,
        message: 'Property not found'
      });
    }
    
    // Verify media exists
    const media = await Media.findByPk(media_id);
    if (!media) {
      return res.status(404).json({
        error: true,
        message: 'Media not found'
      });
    }
    
    // Check if the assignment already exists
    const existingAssignment = await PropertyMedia.findOne({
      where: {
        property_id,
        media_id
      }
    });
    
    if (existingAssignment) {
      return res.status(409).json({
        error: true,
        message: 'This media is already assigned to the property'
      });
    }
    
    // Create the assignment
    const propertyMedia = await PropertyMedia.create({
      property_id,
      media_id,
      display_order: display_order || 0,
      is_featured: is_featured === true
    });
    
    res.status(201).json(propertyMedia);
  } catch (error) {
    logger.error('Error assigning media:', error);
    
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
      message: 'Error assigning media'
    });
  }
};

// Update media assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can update assignments
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can update media assignments'
      });
    }
    
    const propertyMedia = await PropertyMedia.findByPk(id);
    
    if (!propertyMedia) {
      return res.status(404).json({
        error: true,
        message: 'Media assignment not found'
      });
    }
    
    await propertyMedia.update(req.body);
    
    res.status(200).json(propertyMedia);
  } catch (error) {
    logger.error('Error updating media assignment:', error);
    
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
      message: 'Error updating media assignment'
    });
  }
};

// Remove media assignment
exports.removeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can remove assignments
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can remove media assignments'
      });
    }
    
    const propertyMedia = await PropertyMedia.findByPk(id);
    
    if (!propertyMedia) {
      return res.status(404).json({
        error: true,
        message: 'Media assignment not found'
      });
    }
    
    await propertyMedia.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Media assignment removed successfully'
    });
  } catch (error) {
    logger.error('Error removing media assignment:', error);
    res.status(500).json({
      error: true,
      message: 'Error removing media assignment'
    });
  }
};
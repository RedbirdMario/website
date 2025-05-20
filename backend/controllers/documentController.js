const { Document, ClientDocument, Client, User, Property } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const path = require('path');
const fs = require('fs');
const logger = require('./utils/logger');

// Get all documents
exports.getAllDocuments = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, document_type, category, is_template } = req.query;
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
    
    if (document_type) {
      whereConditions.document_type = document_type;
    }
    
    if (category) {
      whereConditions.category = category;
    }
    
    if (is_template !== undefined) {
      whereConditions.is_template = is_template === 'true';
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
      
      // Get documents associated with this client
      const clientDocIds = await ClientDocument.findAll({
        where: { client_id: client.id },
        attributes: ['document_id']
      });
      
      const documentIds = clientDocIds.map(cd => cd.document_id);
      
      // Add template documents
      whereConditions[Op.or] = [
        { id: { [Op.in]: documentIds } },
        { is_template: true }
      ];
    }
    
    // Advisors can see their clients' documents and templates
    if (req.user.role === 'advisor') {
      // Get the advisor's clients
      const clients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = clients.map(client => client.id);
      
      // Get documents associated with these clients
      const clientDocIds = await ClientDocument.findAll({
        where: { client_id: { [Op.in]: clientIds } },
        attributes: ['document_id']
      });
      
      const documentIds = clientDocIds.map(cd => cd.document_id);
      
      // Add advisor's uploaded documents and templates
      whereConditions[Op.or] = [
        { id: { [Op.in]: documentIds } },
        { uploaded_by: req.user.id },
        { is_template: true }
      ];
    }
    
    // Execute query
    const { count, rows: documents } = await Document.findAndCountAll({
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
      documents,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Error fetching documents:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching documents'
    });
  }
};

// Get document by ID
exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findByPk(id, {
      include: [
        {
          model: User,
          as: 'uploader',
          attributes: ['id', 'first_name', 'last_name']
        }
      ]
    });
    
    if (!document) {
      return res.status(404).json({
        error: true,
        message: 'Document not found'
      });
    }
    
    // Access control - clients can only see their own documents and templates
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
      
      // Check if this is the client's document or a template
      if (!document.is_template) {
        const clientDocument = await ClientDocument.findOne({
          where: {
            client_id: client.id,
            document_id: id
          }
        });
        
        if (!clientDocument) {
          return res.status(403).json({
            error: true,
            message: 'Access denied'
          });
        }
      }
    }
    
    // Access control - advisors can only see their clients' documents, their uploads, and templates
    if (req.user.role === 'advisor') {
      // If they uploaded it or it's a template, they can access it
      if (document.uploaded_by === req.user.id || document.is_template) {
        // Allow access
      } else {
        // Check if it belongs to one of their clients
        const advisorClients = await Client.findAll({
          where: { advisor_id: req.user.id },
          attributes: ['id']
        });
        
        const clientIds = advisorClients.map(client => client.id);
        
        const clientDocument = await ClientDocument.findOne({
          where: {
            client_id: { [Op.in]: clientIds },
            document_id: id
          }
        });
        
        if (!clientDocument) {
          return res.status(403).json({
            error: true,
            message: 'Access denied'
          });
        }
      }
    }
    
    res.status(200).json(document);
  } catch (error) {
    logger.error('Error fetching document:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching document'
    });
  }
};

// Upload document
exports.uploadDocument = async (req, res) => {
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
      document_type, 
      category, 
      is_template = false 
    } = req.body;
    
    // Create document record
    const document = await Document.create({
      title,
      description,
      file_path: req.file.path,
      file_name: req.file.originalname,
      file_size: req.file.size,
      file_type: req.file.mimetype,
      document_type,
      category,
      uploaded_by: req.user.id,
      is_template: is_template === 'true'
    });
    
    // Assign document to client if specified
    if (req.body.client_id && !is_template) {
      // Verify client exists
      const client = await Client.findByPk(req.body.client_id);
      if (!client) {
        return res.status(404).json({
          error: true,
          message: 'Client not found'
        });
      }
      
      // Advisors can only assign to their own clients
      if (req.user.role === 'advisor' && client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'You can only assign documents to your own clients'
        });
      }
      
      // Create client document association
      await ClientDocument.create({
        client_id: req.body.client_id,
        document_id: document.id,
        property_id: req.body.property_id || null,
        status: 'pending_review'
      });
    }
    
    res.status(201).json(document);
  } catch (error) {
    logger.error('Error uploading document:', error);
    
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
      message: 'Error uploading document'
    });
  }
};

// Update document
exports.updateDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findByPk(id);
    
    if (!document) {
      return res.status(404).json({
        error: true,
        message: 'Document not found'
      });
    }
    
    // Check permissions: only uploader, admin, or assigned advisor can update
    if (req.user.role !== 'admin' && document.uploaded_by !== req.user.id) {
      // If advisor, check if document belongs to their client
      if (req.user.role === 'advisor') {
        const advisorClients = await Client.findAll({
          where: { advisor_id: req.user.id },
          attributes: ['id']
        });
        
        const clientIds = advisorClients.map(client => client.id);
        
        const clientDocument = await ClientDocument.findOne({
          where: {
            client_id: { [Op.in]: clientIds },
            document_id: id
          }
        });
        
        if (!clientDocument) {
          return res.status(403).json({
            error: true,
            message: 'Access denied'
          });
        }
      } else {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Update document
    await document.update(req.body);
    
    res.status(200).json(document);
  } catch (error) {
    logger.error('Error updating document:', error);
    
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
      message: 'Error updating document'
    });
  }
};

// Delete document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    
    const document = await Document.findByPk(id);
    
    if (!document) {
      return res.status(404).json({
        error: true,
        message: 'Document not found'
      });
    }
    
    // Check permissions: only uploader or admin can delete
    if (req.user.role !== 'admin' && document.uploaded_by !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Delete file from disk
    if (document.file_path && fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }
    
    // Delete client document associations
    await ClientDocument.destroy({
      where: { document_id: id }
    });
    
    // Delete document record
    await document.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting document'
    });
  }
};

// Get client documents
exports.getClientDocuments = async (req, res) => {
  try {
    const { clientId, propertyId, status } = req.query;
    
    // Build where conditions
    const whereConditions = {};
    
    if (clientId) {
      whereConditions.client_id = clientId;
    }
    
    if (propertyId) {
      whereConditions.property_id = propertyId;
    }
    
    if (status) {
      whereConditions.status = status;
    }
    
    // Access control
    // Clients can only see their own documents
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
      
      whereConditions.client_id = client.id;
    }
    
    // Advisors can only see their clients' documents
    if (req.user.role === 'advisor') {
      const advisorClients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = advisorClients.map(client => client.id);
      
      if (clientId && !clientIds.includes(clientId)) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
      
      if (!clientId) {
        whereConditions.client_id = { [Op.in]: clientIds };
      }
    }
    
    // Execute query
    const clientDocuments = await ClientDocument.findAll({
      where: whereConditions,
      include: [
        {
          model: Document,
          as: 'document'
        },
        {
          model: Client,
          as: 'client',
          include: [
            {
              model: User,
              as: 'user',
              attributes: ['first_name', 'last_name']
            }
          ]
        },
        {
          model: Property,
          as: 'property',
          attributes: ['id', 'name', 'unit_number']
        }
      ]
    });
    
    res.status(200).json(clientDocuments);
  } catch (error) {
    logger.error('Error fetching client documents:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching client documents'
    });
  }
};

// Assign document to client
exports.assignDocument = async (req, res) => {
  try {
    const { client_id, document_id, property_id, status } = req.body;
    
    // Only admins and advisors can assign documents
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can assign documents'
      });
    }
    
    // Verify client exists
    const client = await Client.findByPk(client_id);
    if (!client) {
      return res.status(404).json({
        error: true,
        message: 'Client not found'
      });
    }
    
    // Advisors can only assign to their own clients
    if (req.user.role === 'advisor' && client.advisor_id !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'You can only assign documents to your own clients'
      });
    }
    
    // Verify document exists
    const document = await Document.findByPk(document_id);
    if (!document) {
      return res.status(404).json({
        error: true,
        message: 'Document not found'
      });
    }
    
    // If property_id is provided, verify it exists
    if (property_id) {
      const property = await Property.findByPk(property_id);
      if (!property) {
        return res.status(404).json({
          error: true,
          message: 'Property not found'
        });
      }
    }
    
    // Check if the assignment already exists
    const existingAssignment = await ClientDocument.findOne({
      where: {
        client_id,
        document_id,
        property_id: property_id || null
      }
    });
    
    if (existingAssignment) {
      return res.status(409).json({
        error: true,
        message: 'This document is already assigned to the client'
      });
    }
    
    // Create the assignment
    const clientDocument = await ClientDocument.create({
      client_id,
      document_id,
      property_id: property_id || null,
      status: status || 'pending_review'
    });
    
    res.status(201).json(clientDocument);
  } catch (error) {
    logger.error('Error assigning document:', error);
    
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
      message: 'Error assigning document'
    });
  }
};

// Update document assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can update assignments
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can update document assignments'
      });
    }
    
    const clientDocument = await ClientDocument.findByPk(id);
    
    if (!clientDocument) {
      return res.status(404).json({
        error: true,
        message: 'Document assignment not found'
      });
    }
    
    // Advisors can only update their own clients' assignments
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(clientDocument.client_id);
      
      if (client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'You can only update document assignments for your own clients'
        });
      }
    }
    
    await clientDocument.update(req.body);
    
    res.status(200).json(clientDocument);
  } catch (error) {
    logger.error('Error updating document assignment:', error);
    
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
      message: 'Error updating document assignment'
    });
  }
};

// Remove document assignment
exports.removeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can remove assignments
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can remove document assignments'
      });
    }
    
    const clientDocument = await ClientDocument.findByPk(id);
    
    if (!clientDocument) {
      return res.status(404).json({
        error: true,
        message: 'Document assignment not found'
      });
    }
    
    // Advisors can only remove their own clients' assignments
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(clientDocument.client_id);
      
      if (client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'You can only remove document assignments for your own clients'
        });
      }
    }
    
    await clientDocument.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Document assignment removed successfully'
    });
  } catch (error) {
    logger.error('Error removing document assignment:', error);
    res.status(500).json({
      error: true,
      message: 'Error removing document assignment'
    });
  }
};
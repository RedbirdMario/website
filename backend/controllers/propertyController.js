const { Property, ClientProperty, Client } = require('../models');
const { Op } = require('sequelize');
const logger = require('./utils/logger');

// Get all properties
exports.getAllProperties = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status } = req.query;
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const whereConditions = {};
    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { location: { [Op.iLike]: `%${search}%` } },
        { unit_number: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (status) {
      whereConditions.status = status;
    }
    
    // Only admins can see all properties, advisors see only their clients' properties
    if (req.user.role === 'advisor') {
      const advisorClients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = advisorClients.map(client => client.id);
      
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: { [Op.in]: clientIds } },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      whereConditions.id = { [Op.in]: propertyIds };
    }
    
    // Regular client users can only see their own properties
    if (req.user.role === 'client') {
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client) {
        return res.status(403).json({
          error: true,
          message: 'Client profile not found'
        });
      }
      
      const clientProperties = await ClientProperty.findAll({
        where: { client_id: client.id },
        attributes: ['property_id']
      });
      
      const propertyIds = clientProperties.map(cp => cp.property_id);
      
      whereConditions.id = { [Op.in]: propertyIds };
    }
    
    // Execute query
    const { count, rows: properties } = await Property.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    // Return paginated results
    res.status(200).json({
      properties,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Error fetching properties:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching properties'
    });
  }
};

// Get property by ID
exports.getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const property = await Property.findByPk(id);
    
    if (!property) {
      return res.status(404).json({
        error: true,
        message: 'Property not found'
      });
    }
    
    // Access control - clients can only see their own properties
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
      
      const clientProperty = await ClientProperty.findOne({
        where: {
          client_id: client.id,
          property_id: id
        }
      });
      
      if (!clientProperty) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Access control - advisors can only see their clients' properties
    if (req.user.role === 'advisor') {
      const advisorClients = await Client.findAll({
        where: { advisor_id: req.user.id },
        attributes: ['id']
      });
      
      const clientIds = advisorClients.map(client => client.id);
      
      const clientProperty = await ClientProperty.findOne({
        where: {
          client_id: { [Op.in]: clientIds },
          property_id: id
        }
      });
      
      if (!clientProperty) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    res.status(200).json(property);
  } catch (error) {
    logger.error('Error fetching property:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching property'
    });
  }
};

// Create new property (admin only)
exports.createProperty = async (req, res) => {
  try {
    // Only admins can create properties
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can create properties'
      });
    }
    
    const property = await Property.create(req.body);
    
    res.status(201).json(property);
  } catch (error) {
    logger.error('Error creating property:', error);
    
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
      message: 'Error creating property'
    });
  }
};

// Update property (admin only)
exports.updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can update properties
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can update properties'
      });
    }
    
    const property = await Property.findByPk(id);
    
    if (!property) {
      return res.status(404).json({
        error: true,
        message: 'Property not found'
      });
    }
    
    await property.update(req.body);
    
    res.status(200).json(property);
  } catch (error) {
    logger.error('Error updating property:', error);
    
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
      message: 'Error updating property'
    });
  }
};

// Delete property (admin only)
exports.deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can delete properties
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can delete properties'
      });
    }
    
    const property = await Property.findByPk(id);
    
    if (!property) {
      return res.status(404).json({
        error: true,
        message: 'Property not found'
      });
    }
    
    await property.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Property deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting property:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting property'
    });
  }
};

// Get client properties
exports.getClientProperties = async (req, res) => {
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
    // Clients can only see their own properties
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
    
    // Advisors can only see their clients' properties
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
    const clientProperties = await ClientProperty.findAll({
      where: whereConditions,
      include: [
        {
          model: Property,
          attributes: ['id', 'name', 'unit_number', 'location', 'bedrooms', 'bathrooms']
        }
      ]
    });
    
    res.status(200).json(clientProperties);
  } catch (error) {
    logger.error('Error fetching client properties:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching client properties'
    });
  }
};

// Assign property to client (admin and advisor)
exports.assignProperty = async (req, res) => {
  try {
    const { client_id, property_id, status } = req.body;
    
    // Only admins and advisors can assign properties
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can assign properties'
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
        message: 'You can only assign properties to your own clients'
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
    
    // Check if the assignment already exists
    const existingAssignment = await ClientProperty.findOne({
      where: {
        client_id,
        property_id
      }
    });
    
    if (existingAssignment) {
      return res.status(409).json({
        error: true,
        message: 'This property is already assigned to the client'
      });
    }
    
    // Create the assignment
    const clientProperty = await ClientProperty.create({
      client_id,
      property_id,
      status: status || 'inquiry',
      overall_progress: 0
    });
    
    res.status(201).json(clientProperty);
  } catch (error) {
    logger.error('Error assigning property:', error);
    
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
      message: 'Error assigning property'
    });
  }
};

// Update client property assignment
exports.updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can update assignments
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can update property assignments'
      });
    }
    
    const clientProperty = await ClientProperty.findByPk(id);
    
    if (!clientProperty) {
      return res.status(404).json({
        error: true,
        message: 'Property assignment not found'
      });
    }
    
    // Advisors can only update their own clients' assignments
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(clientProperty.client_id);
      
      if (client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'You can only update property assignments for your own clients'
        });
      }
    }
    
    await clientProperty.update(req.body);
    
    res.status(200).json(clientProperty);
  } catch (error) {
    logger.error('Error updating property assignment:', error);
    
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
      message: 'Error updating property assignment'
    });
  }
};

// Remove property assignment
exports.removeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can remove assignments
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can remove property assignments'
      });
    }
    
    const clientProperty = await ClientProperty.findByPk(id);
    
    if (!clientProperty) {
      return res.status(404).json({
        error: true,
        message: 'Property assignment not found'
      });
    }
    
    // Advisors can only remove their own clients' assignments
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(clientProperty.client_id);
      
      if (client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'You can only remove property assignments for your own clients'
        });
      }
    }
    
    await clientProperty.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Property assignment removed successfully'
    });
  } catch (error) {
    logger.error('Error removing property assignment:', error);
    res.status(500).json({
      error: true,
      message: 'Error removing property assignment'
    });
  }
};

// Get client property by ID
exports.getClientPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const clientProperty = await ClientProperty.findByPk(id, {
      include: [
        {
          model: Property,
          attributes: ['id', 'name', 'unit_number', 'location', 'bedrooms', 'bathrooms', 'status']
        },
        {
          model: Client,
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone']
        }
      ]
    });
    
    if (!clientProperty) {
      return res.status(404).json({
        error: true,
        message: 'Client property not found'
      });
    }
    
    // Access control
    // Clients can only see their own properties
    if (req.user.role === 'client') {
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client || clientProperty.client_id !== client.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Advisors can only see their clients' properties
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(clientProperty.client_id);
      
      if (!client || client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    res.status(200).json(clientProperty);
  } catch (error) {
    logger.error('Error fetching client property:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching client property'
    });
  }
};
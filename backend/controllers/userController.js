const { User, Client } = require('../models');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const logger = require('./utils/logger');

// Get all users (admin only)
exports.getAllUsers = async (req, res) => {
  try {
    // Only admins can see all users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }

    const { page = 1, limit = 10, search, role } = req.query;
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const whereConditions = {};
    if (search) {
      whereConditions[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } }
      ];
    }
    
    if (role) {
      whereConditions.role = role;
    }
    
    // Execute query
    const { count, rows: users } = await User.findAndCountAll({
      where: whereConditions,
      attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });
    
    // Return paginated results
    res.status(200).json({
      users,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Error fetching users:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching users'
    });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can see themselves, admins can see anyone
    if (id !== req.user.id && req.user.role !== 'admin') {
      // Advisors can see their clients
      if (req.user.role === 'advisor') {
        const clientUser = await Client.findOne({
          where: { 
            advisor_id: req.user.id,
            user_id: id 
          }
        });
        
        if (!clientUser) {
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
    
    const user = await User.findByPk(id, {
      attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] }
    });
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }
    
    // For client users, include client details
    if (user.role === 'client') {
      const client = await Client.findOne({
        where: { user_id: id },
        include: [
          {
            model: User,
            as: 'advisor',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'avatar_url']
          }
        ]
      });
      
      if (client) {
        user.dataValues.client_details = {
          id: client.id,
          notes: client.notes,
          special_requirements: client.special_requirements,
          advisor: client.advisor ? {
            id: client.advisor.id,
            name: `${client.advisor.first_name} ${client.advisor.last_name}`,
            email: client.advisor.email,
            phone: client.advisor.phone,
            avatar_url: client.advisor.avatar_url
          } : null
        };
      }
    }
    
    res.status(200).json(user);
  } catch (error) {
    logger.error('Error fetching user:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching user'
    });
  }
};

// Create user (admin only)
exports.createUser = async (req, res) => {
  try {
    // Only admins can create users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can create users'
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
    
    const { 
      email, 
      password, 
      first_name, 
      last_name, 
      role, 
      avatar_url,
      phone,
      is_active
    } = req.body;
    
    // Check if user with this email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        error: true,
        message: 'Email already in use'
      });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await User.create({
      email,
      password_hash,
      first_name,
      last_name,
      role: role || 'client',
      avatar_url,
      phone,
      is_active: is_active !== undefined ? is_active : true
    });
    
    // If creating a client user, create client record
    if (user.role === 'client' && req.body.advisor_id) {
      // Verify the advisor exists and is an advisor
      const advisor = await User.findOne({
        where: {
          id: req.body.advisor_id,
          role: 'advisor'
        }
      });
      
      if (!advisor) {
        return res.status(404).json({
          error: true,
          message: 'Advisor not found'
        });
      }
      
      // Create client record
      await Client.create({
        user_id: user.id,
        advisor_id: req.body.advisor_id,
        notes: req.body.notes,
        special_requirements: req.body.special_requirements
      });
    }
    
    // Return user without sensitive fields
    const { password_hash: _, ...userData } = user.toJSON();
    
    res.status(201).json(userData);
  } catch (error) {
    logger.error('Error creating user:', error);
    
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
      message: 'Error creating user'
    });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Users can update themselves, admins can update anyone
    if (id !== req.user.id && req.user.role !== 'admin') {
      // Advisors can update their clients
      if (req.user.role === 'advisor') {
        const clientUser = await Client.findOne({
          where: { 
            advisor_id: req.user.id,
            user_id: id 
          }
        });
        
        if (!clientUser) {
          return res.status(403).json({
            error: true,
            message: 'Access denied'
          });
        }
        
        // Advisors can't change certain fields
        const restrictedFields = ['role', 'email', 'password', 'is_active'];
        const hasRestrictedFields = restrictedFields.some(field => req.body[field] !== undefined);
        
        if (hasRestrictedFields) {
          return res.status(403).json({
            error: true,
            message: 'You do not have permission to update these fields'
          });
        }
      } else {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }
    
    // Prepare update data
    const updateData = { ...req.body };
    
    // If changing email, check if it's already in use
    if (updateData.email && updateData.email !== user.email) {
      const existingUser = await User.findOne({ where: { email: updateData.email } });
      if (existingUser) {
        return res.status(409).json({
          error: true,
          message: 'Email already in use'
        });
      }
    }
    
    // Handle password update
    if (updateData.password) {
      updateData.password_hash = await bcrypt.hash(updateData.password, 12);
      delete updateData.password;
    }
    
    // Non-admins cannot change their own role or active status
    if (id === req.user.id && req.user.role !== 'admin') {
      delete updateData.role;
      delete updateData.is_active;
    }
    
    // Update user
    await user.update(updateData);
    
    // Update client record if applicable
    if (user.role === 'client' && (req.body.advisor_id || req.body.notes || req.body.special_requirements)) {
      let client = await Client.findOne({ where: { user_id: id } });
      
      const clientUpdateData = {};
      
      if (req.body.advisor_id) {
        // Verify the advisor exists and is an advisor
        const advisor = await User.findOne({
          where: {
            id: req.body.advisor_id,
            role: 'advisor'
          }
        });
        
        if (!advisor) {
          return res.status(404).json({
            error: true,
            message: 'Advisor not found'
          });
        }
        
        clientUpdateData.advisor_id = req.body.advisor_id;
      }
      
      if (req.body.notes !== undefined) {
        clientUpdateData.notes = req.body.notes;
      }
      
      if (req.body.special_requirements !== undefined) {
        clientUpdateData.special_requirements = req.body.special_requirements;
      }
      
      if (client) {
        // Update existing client record
        await client.update(clientUpdateData);
      } else {
        // Create new client record
        await Client.create({
          user_id: id,
          ...clientUpdateData
        });
      }
    }
    
    // Return updated user without sensitive fields
    const updatedUser = await User.findByPk(id, {
      attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] }
    });
    
    // For client users, include client details
    if (updatedUser.role === 'client') {
      const client = await Client.findOne({
        where: { user_id: id },
        include: [
          {
            model: User,
            as: 'advisor',
            attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'avatar_url']
          }
        ]
      });
      
      if (client) {
        updatedUser.dataValues.client_details = {
          id: client.id,
          notes: client.notes,
          special_requirements: client.special_requirements,
          advisor: client.advisor ? {
            id: client.advisor.id,
            name: `${client.advisor.first_name} ${client.advisor.last_name}`,
            email: client.advisor.email,
            phone: client.advisor.phone,
            avatar_url: client.advisor.avatar_url
          } : null
        };
      }
    }
    
    res.status(200).json(updatedUser);
  } catch (error) {
    logger.error('Error updating user:', error);
    
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
      message: 'Error updating user'
    });
  }
};

// Delete user (admin only)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can delete users
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can delete users'
      });
    }
    
    // Cannot delete yourself
    if (id === req.user.id) {
      return res.status(400).json({
        error: true,
        message: 'You cannot delete your own account'
      });
    }
    
    const user = await User.findByPk(id);
    
    if (!user) {
      return res.status(404).json({
        error: true,
        message: 'User not found'
      });
    }
    
    // Delete associated client record if needed
    if (user.role === 'client') {
      await Client.destroy({ where: { user_id: id } });
    }
    
    // Delete user
    await user.destroy();
    
    res.status(200).json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting user:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting user'
    });
  }
};

// Get all advisors
exports.getAdvisors = async (req, res) => {
  try {
    const advisors = await User.findAll({
      where: { role: 'advisor' },
      attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] },
      order: [['first_name', 'ASC'], ['last_name', 'ASC']]
    });
    
    res.status(200).json(advisors);
  } catch (error) {
    logger.error('Error fetching advisors:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching advisors'
    });
  }
};

// Get advisor's clients
exports.getAdvisorClients = async (req, res) => {
  try {
    const { advisorId } = req.params;
    
    // Verify permissions
    if (req.user.role !== 'admin' && req.user.id !== advisorId) {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Verify advisor exists
    const advisor = await User.findOne({
      where: {
        id: advisorId,
        role: 'advisor'
      }
    });
    
    if (!advisor) {
      return res.status(404).json({
        error: true,
        message: 'Advisor not found'
      });
    }
    
    // Get advisor's clients
    const clients = await Client.findAll({
      where: { advisor_id: advisorId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: { exclude: ['password_hash', 'password_reset_token', 'password_reset_expires'] }
        }
      ]
    });
    
    // Format response
    const formattedClients = clients.map(client => ({
      id: client.id,
      user_id: client.user.id,
      email: client.user.email,
      first_name: client.user.first_name,
      last_name: client.user.last_name,
      full_name: `${client.user.first_name} ${client.user.last_name}`,
      phone: client.user.phone,
      avatar_url: client.user.avatar_url,
      is_active: client.user.is_active,
      notes: client.notes,
      special_requirements: client.special_requirements,
      created_at: client.createdAt
    }));
    
    res.status(200).json(formattedClients);
  } catch (error) {
    logger.error('Error fetching advisor clients:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching advisor clients'
    });
  }
};

// Assign client to advisor
exports.assignClientToAdvisor = async (req, res) => {
  try {
    // Only admins can assign clients to advisors
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can assign clients to advisors'
      });
    }
    
    const { client_id, advisor_id } = req.body;
    
    // Verify client exists and is a client
    const client = await Client.findOne({
      where: { id: client_id },
      include: [
        {
          model: User,
          as: 'user',
          where: { role: 'client' }
        }
      ]
    });
    
    if (!client) {
      return res.status(404).json({
        error: true,
        message: 'Client not found'
      });
    }
    
    // Verify advisor exists and is an advisor
    if (advisor_id) {
      const advisor = await User.findOne({
        where: {
          id: advisor_id,
          role: 'advisor'
        }
      });
      
      if (!advisor) {
        return res.status(404).json({
          error: true,
          message: 'Advisor not found'
        });
      }
    }
    
    // Update client
    await client.update({
      advisor_id: advisor_id || null
    });
    
    res.status(200).json({
      success: true,
      message: advisor_id 
        ? 'Client assigned to advisor successfully' 
        : 'Client unassigned from advisor successfully'
    });
  } catch (error) {
    logger.error('Error assigning client to advisor:', error);
    res.status(500).json({
      error: true,
      message: 'Error assigning client to advisor'
    });
  }
};
const { Message, User, Client } = require('../models');
const { validationResult } = require('express-validator');
const { Op, literal, fn, col } = require('sequelize');
const logger = require('../utils/logger');

// Get user messages
exports.getUserMessages = async (req, res) => {
  try {
    const { page = 1, limit = 10, is_read, conversation_with } = req.query;
    const offset = (page - 1) * limit;
    
    // Users can only see their own messages
    const whereConditions = {
      [Op.or]: [
        { sender_id: req.user.id },
        { recipient_id: req.user.id }
      ]
    };
    
    // Filter by read status if provided
    if (is_read !== undefined && is_read === 'false') {
      whereConditions.is_read = false;
      whereConditions.recipient_id = req.user.id; // Only recipients can mark as read
    }
    
    // Filter by conversation partner if provided
    if (conversation_with) {
      whereConditions[Op.and] = [
        {
          [Op.or]: [
            {
              [Op.and]: [
                { sender_id: req.user.id },
                { recipient_id: conversation_with }
              ]
            },
            {
              [Op.and]: [
                { sender_id: conversation_with },
                { recipient_id: req.user.id }
              ]
            }
          ]
        }
      ];
    }
    
    // Get only parent messages (not replies)
    if (!conversation_with) {
      whereConditions.parent_message_id = null;
    }
    
    // Execute query
    const { count, rows: messages } = await Message.findAndCountAll({
      where: whereConditions,
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
        },
        {
          model: Message,
          as: 'replies',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
            },
            {
              model: User,
              as: 'recipient',
              attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
            }
          ]
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC'], [{ model: Message, as: 'replies' }, 'createdAt', 'ASC']]
    });
    
    // Return paginated results
    res.status(200).json({
      messages,
      total: count,
      unread_count: await Message.count({
        where: {
          recipient_id: req.user.id,
          is_read: false
        }
      }),
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / limit)
    });
  } catch (error) {
    logger.error('Error fetching messages:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching messages'
    });
  }
};

// Get message by ID
exports.getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = await Message.findByPk(id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
        },
        {
          model: Message,
          as: 'parentMessage',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
            }
          ]
        },
        {
          model: Message,
          as: 'replies',
          include: [
            {
              model: User,
              as: 'sender',
              attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
            },
            {
              model: User,
              as: 'recipient',
              attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
            }
          ],
          order: [['createdAt', 'ASC']]
        }
      ]
    });
    
    if (!message) {
      return res.status(404).json({
        error: true,
        message: 'Message not found'
      });
    }
    
    // Users can only see their own messages
    if (message.sender_id !== req.user.id && message.recipient_id !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Mark message as read if user is the recipient
    if (message.recipient_id === req.user.id && !message.is_read) {
      await message.update({
        is_read: true,
        read_at: new Date()
      });
    }
    
    res.status(200).json(message);
  } catch (error) {
    logger.error('Error fetching message:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching message'
    });
  }
};

// Send message
exports.sendMessage = async (req, res) => {
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
    
    const { recipient_id, subject, content, parent_message_id } = req.body;
    
    // Verify recipient exists
    const recipient = await User.findByPk(recipient_id);
    if (!recipient) {
      return res.status(404).json({
        error: true,
        message: 'Recipient not found'
      });
    }
    
    // If parent message provided, verify it exists
    if (parent_message_id) {
      const parentMessage = await Message.findByPk(parent_message_id);
      if (!parentMessage) {
        return res.status(404).json({
          error: true,
          message: 'Parent message not found'
        });
      }
      
      // Verify user is participant in parent message
      if (parentMessage.sender_id !== req.user.id && parentMessage.recipient_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'You can only reply to messages you are part of'
        });
      }
    }
    
    // Access control for advisors and clients
    if (req.user.role === 'client') {
      // Clients can only message their advisor or admins
      if (recipient.role === 'client') {
        return res.status(403).json({
          error: true,
          message: 'Clients cannot message other clients'
        });
      }
      
      if (recipient.role === 'advisor') {
        // Verify this is the client's advisor
        const client = await Client.findOne({
          where: { 
            user_id: req.user.id,
            advisor_id: recipient_id
          }
        });
        
        if (!client) {
          return res.status(403).json({
            error: true,
            message: 'You can only message your assigned advisor'
          });
        }
      }
    } else if (req.user.role === 'advisor') {
      // Advisors can only message their clients or admins
      if (recipient.role === 'client') {
        // Verify this is the advisor's client
        const client = await Client.findOne({
          where: { 
            user_id: recipient_id,
            advisor_id: req.user.id
          }
        });
        
        if (!client) {
          return res.status(403).json({
            error: true,
            message: 'You can only message your assigned clients'
          });
        }
      } else if (recipient.role === 'advisor') {
        return res.status(403).json({
          error: true,
          message: 'Advisors cannot message other advisors'
        });
      }
    }
    
    // Create message
    const message = await Message.create({
      sender_id: req.user.id,
      recipient_id,
      subject: parent_message_id ? undefined : subject,
      content,
      parent_message_id,
      is_read: false
    });
    
    // Load sender and recipient info
    const fullMessage = await Message.findByPk(message.id, {
      include: [
        {
          model: User,
          as: 'sender',
          attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
        },
        {
          model: User,
          as: 'recipient',
          attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
        }
      ]
    });
    
    res.status(201).json(fullMessage);
  } catch (error) {
    logger.error('Error sending message:', error);
    
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
      message: 'Error sending message'
    });
  }
};

// Mark message as read
exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = await Message.findByPk(id);
    
    if (!message) {
      return res.status(404).json({
        error: true,
        message: 'Message not found'
      });
    }
    
    // Only recipients can mark messages as read
    if (message.recipient_id !== req.user.id) {
      return res.status(403).json({
        error: true,
        message: 'Only the recipient can mark a message as read'
      });
    }
    
    // Update message
    await message.update({
      is_read: true,
      read_at: new Date()
    });
    
    res.status(200).json({
      success: true,
      message: 'Message marked as read'
    });
  } catch (error) {
    logger.error('Error updating message:', error);
    res.status(500).json({
      error: true,
      message: 'Error updating message'
    });
  }
};

// Mark all messages as read
exports.markAllAsRead = async (req, res) => {
  try {
    // Update all unread messages where user is recipient
    await Message.update(
      {
        is_read: true,
        read_at: new Date()
      },
      {
        where: {
          recipient_id: req.user.id,
          is_read: false
        }
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'All messages marked as read'
    });
  } catch (error) {
    logger.error('Error updating messages:', error);
    res.status(500).json({
      error: true,
      message: 'Error updating messages'
    });
  }
};

// Delete message
exports.deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;
    
    const message = await Message.findByPk(id);
    
    if (!message) {
      return res.status(404).json({
        error: true,
        message: 'Message not found'
      });
    }
    
    // Only sender, recipient, or admin can delete messages
    if (message.sender_id !== req.user.id && message.recipient_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Access denied'
      });
    }
    
    // Delete message
    await message.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting message:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting message'
    });
  }
};

// Get user conversations
exports.getUserConversations = async (req, res) => {
  try {
    // Get all unique conversation partners
    const conversations = await Message.findAll({
      attributes: [
        [
          literal(`
            CASE
              WHEN sender_id = '${req.user.id}' THEN recipient_id
              ELSE sender_id
            END
          `),
          'partner_id'
        ],
        [
          literal(`
            MAX(created_at)
          `),
          'last_message_at'
        ],
        [
          literal(`
            SUM(CASE WHEN recipient_id = '${req.user.id}' AND is_read = false THEN 1 ELSE 0 END)
          `),
          'unread_count'
        ]
      ],
      where: {
        [Op.or]: [
          { sender_id: req.user.id },
          { recipient_id: req.user.id }
        ],
        parent_message_id: null // Only count parent messages for conversations
      },
      group: [
        literal(`
          CASE
            WHEN sender_id = '${req.user.id}' THEN recipient_id
            ELSE sender_id
          END
        `)
      ],
      order: [[literal('last_message_at'), 'DESC']]
    });
    
    // Get user details for each conversation partner
    const partnerIds = conversations.map(c => c.dataValues.partner_id);
    
    const partners = await User.findAll({
      where: { id: { [Op.in]: partnerIds } },
      attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'role']
    });
    
    // Get the last message for each conversation
    const lastMessages = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({
          where: {
            [Op.or]: [
              {
                [Op.and]: [
                  { sender_id: req.user.id },
                  { recipient_id: conv.dataValues.partner_id }
                ]
              },
              {
                [Op.and]: [
                  { sender_id: conv.dataValues.partner_id },
                  { recipient_id: req.user.id }
                ]
              }
            ],
            parent_message_id: null
          },
          attributes: ['id', 'subject', 'content', 'created_at', 'sender_id', 'is_read'],
          order: [['createdAt', 'DESC']],
          limit: 1
        });
        
        return lastMessage;
      })
    );
    
    // Combine data for response
    const conversationData = conversations.map((conv, index) => {
      const partner = partners.find(p => p.id === conv.dataValues.partner_id);
      return {
        partner_id: conv.dataValues.partner_id,
        partner: partner ? {
          id: partner.id,
          name: `${partner.first_name} ${partner.last_name}`,
          email: partner.email,
          avatar_url: partner.avatar_url,
          role: partner.role
        } : null,
        last_message_at: conv.dataValues.last_message_at,
        unread_count: parseInt(conv.dataValues.unread_count),
        last_message: lastMessages[index] ? {
          id: lastMessages[index].id,
          subject: lastMessages[index].subject,
          content: lastMessages[index].content.substring(0, 100) + (lastMessages[index].content.length > 100 ? '...' : ''),
          created_at: lastMessages[index].created_at,
          is_outgoing: lastMessages[index].sender_id === req.user.id,
          is_read: lastMessages[index].is_read
        } : null
      };
    });
    
    res.status(200).json(conversationData);
  } catch (error) {
    logger.error('Error fetching conversations:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching conversations'
    });
  }
};
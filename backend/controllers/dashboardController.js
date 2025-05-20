const { User, Client, Property, ClientProperty } = require('../models');
const logger = require('./utils/logger');

// Get dashboard data
exports.getDashboardData = async (req, res) => {
  try {
    // Get user info
    const user = req.user;
    
    // Initialize response object
    const dashboardData = {
      user_info: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        avatar_url: user.avatar_url,
        full_name: `${user.first_name} ${user.last_name}`
      },
      properties: [],
      recent_documents: [],
      progress_summary: null,
      notifications: {
        unread_count: 0,
        recent: []
      },
      messages: {
        unread_count: 0,
        recent: []
      }
    };
    
    // Client-specific data
    if (user.role === 'client') {
      // Get client profile
      const client = await Client.findOne({
        where: { user_id: user.id },
        include: [{
          model: User,
          as: 'advisor',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone', 'avatar_url']
        }]
      });
      
      if (client) {
        // Add advisor info
        dashboardData.advisor = client.advisor ? {
          id: client.advisor.id,
          name: `${client.advisor.first_name} ${client.advisor.last_name}`,
          email: client.advisor.email,
          phone: client.advisor.phone,
          avatar_url: client.advisor.avatar_url
        } : null;
        
        // Get client properties
        const clientProperties = await ClientProperty.findAll({
          where: { client_id: client.id },
          include: [{
            model: Property,
            attributes: [
              'id', 'name', 'description', 'unit_number', 'location', 
              'price', 'currency', 'bedrooms', 'bathrooms', 'area_size', 
              'area_unit', 'features', 'status'
            ]
          }]
        });
        
        // Format properties
        dashboardData.properties = clientProperties.map(cp => ({
          id: cp.property.id,
          name: cp.property.name,
          unit_number: cp.property.unit_number,
          location: cp.property.location,
          description: cp.property.description,
          bedrooms: cp.property.bedrooms,
          bathrooms: cp.property.bathrooms,
          area_size: cp.property.area_size,
          area_unit: cp.property.area_unit,
          price: cp.property.price,
          currency: cp.property.currency,
          features: cp.property.features,
          status: cp.property.status,
          purchase_status: cp.status,
          purchase_date: cp.purchase_date,
          client_property_id: cp.id,
          progress: {
            percentage: cp.overall_progress || 0,
            current_phase: cp.current_phase || 'Initial Contact'
          }
        }));
        
        // Get the primary property (first one for now)
        if (dashboardData.properties.length > 0) {
          const primaryProperty = dashboardData.properties[0];
          
          // Set progress summary from the primary property
          dashboardData.progress_summary = {
            percentage: primaryProperty.progress.percentage,
            current_phase: primaryProperty.progress.current_phase
          };
        }
      }
    }
    
    // Advisor-specific data
    if (user.role === 'advisor') {
      // Get advisor's clients
      const clients = await Client.findAll({
        where: { advisor_id: user.id },
        include: [
          {
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'email', 'avatar_url']
          }
        ]
      });
      
      // Add clients to the response
      dashboardData.clients = clients.map(client => ({
        id: client.id,
        user_id: client.user.id,
        name: `${client.user.first_name} ${client.user.last_name}`,
        email: client.user.email,
        avatar_url: client.user.avatar_url
      }));
      
      // Get recent client property assignments
      const clientProperties = await ClientProperty.findAll({
        where: { 
          client_id: clients.map(client => client.id) 
        },
        include: [
          {
            model: Property,
            attributes: ['id', 'name', 'unit_number']
          },
          {
            model: Client,
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['first_name', 'last_name']
              }
            ]
          }
        ],
        limit: 5,
        order: [['updatedAt', 'DESC']]
      });
      
      // Format properties
      dashboardData.recent_activities = clientProperties.map(cp => ({
        id: cp.id,
        client_name: `${cp.client.user.first_name} ${cp.client.user.last_name}`,
        property_name: cp.property.name,
        property_unit: cp.property.unit_number,
        status: cp.status,
        progress: cp.overall_progress,
        updated_at: cp.updatedAt
      }));
    }
    
    // Admin-specific data
    if (user.role === 'admin') {
      // Get counts for dashboard stats
      const [clientCount, propertyCount, advisorCount] = await Promise.all([
        Client.count(),
        Property.count(),
        User.count({ where: { role: 'advisor' } })
      ]);
      
      // Add admin stats
      dashboardData.admin_stats = {
        client_count: clientCount,
        property_count: propertyCount,
        advisor_count: advisorCount
      };
      
      // Get recent client property assignments
      const clientProperties = await ClientProperty.findAll({
        include: [
          {
            model: Property,
            attributes: ['id', 'name', 'unit_number']
          },
          {
            model: Client,
            include: [
              {
                model: User,
                as: 'user',
                attributes: ['first_name', 'last_name']
              }
            ]
          }
        ],
        limit: 10,
        order: [['updatedAt', 'DESC']]
      });
      
      // Format recent activities
      dashboardData.recent_activities = clientProperties.map(cp => ({
        id: cp.id,
        client_name: `${cp.client.user.first_name} ${cp.client.user.last_name}`,
        property_name: cp.property.name,
        property_unit: cp.property.unit_number,
        status: cp.status,
        progress: cp.overall_progress,
        updated_at: cp.updatedAt
      }));
    }
    
    // Return the dashboard data
    res.status(200).json(dashboardData);
  } catch (error) {
    logger.error('Error fetching dashboard data:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching dashboard data'
    });
  }
};
const { 
  ProgressPhase, 
  ProgressStep, 
  ClientProgress, 
  ClientProperty, 
  Client, 
  Property, 
  User 
} = require('../models');
const { validationResult } = require('express-validator');
const { Op, literal, fn, col } = require('sequelize');
const logger = require('./utils/logger');

// Get all progress phases
exports.getAllPhases = async (req, res) => {
  try {
    const phases = await ProgressPhase.findAll({
      include: [
        {
          model: ProgressStep,
          as: 'steps',
          order: [['display_order', 'ASC']]
        }
      ],
      order: [['display_order', 'ASC']]
    });
    
    res.status(200).json(phases);
  } catch (error) {
    logger.error('Error fetching progress phases:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching progress phases'
    });
  }
};

// Get phase by ID
exports.getPhaseById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const phase = await ProgressPhase.findByPk(id, {
      include: [
        {
          model: ProgressStep,
          as: 'steps',
          order: [['display_order', 'ASC']]
        }
      ]
    });
    
    if (!phase) {
      return res.status(404).json({
        error: true,
        message: 'Progress phase not found'
      });
    }
    
    res.status(200).json(phase);
  } catch (error) {
    logger.error('Error fetching progress phase:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching progress phase'
    });
  }
};

// Create progress phase (admin only)
exports.createPhase = async (req, res) => {
  try {
    // Only admins can create phases
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can create progress phases'
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
    
    // Create phase
    const phase = await ProgressPhase.create(req.body);
    
    res.status(201).json(phase);
  } catch (error) {
    logger.error('Error creating progress phase:', error);
    
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
      message: 'Error creating progress phase'
    });
  }
};

// Update progress phase (admin only)
exports.updatePhase = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can update phases
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can update progress phases'
      });
    }
    
    const phase = await ProgressPhase.findByPk(id);
    
    if (!phase) {
      return res.status(404).json({
        error: true,
        message: 'Progress phase not found'
      });
    }
    
    // Update phase
    await phase.update(req.body);
    
    res.status(200).json(phase);
  } catch (error) {
    logger.error('Error updating progress phase:', error);
    
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
      message: 'Error updating progress phase'
    });
  }
};

// Delete progress phase (admin only)
exports.deletePhase = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can delete phases
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can delete progress phases'
      });
    }
    
    const phase = await ProgressPhase.findByPk(id);
    
    if (!phase) {
      return res.status(404).json({
        error: true,
        message: 'Progress phase not found'
      });
    }
    
    // Check if there are steps associated with this phase
    const stepsCount = await ProgressStep.count({ where: { phase_id: id } });
    
    if (stepsCount > 0) {
      return res.status(400).json({
        error: true,
        message: 'Cannot delete phase with associated steps'
      });
    }
    
    // Delete the phase
    await phase.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Progress phase deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting progress phase:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting progress phase'
    });
  }
};

// Get all progress steps
exports.getAllSteps = async (req, res) => {
  try {
    const { phase_id } = req.query;
    
    const whereConditions = {};
    if (phase_id) {
      whereConditions.phase_id = phase_id;
    }
    
    const steps = await ProgressStep.findAll({
      where: whereConditions,
      include: [
        {
          model: ProgressPhase,
          as: 'phase',
          attributes: ['id', 'name', 'display_order']
        }
      ],
      order: [
        [{ model: ProgressPhase, as: 'phase' }, 'display_order', 'ASC'],
        ['display_order', 'ASC']
      ]
    });
    
    res.status(200).json(steps);
  } catch (error) {
    logger.error('Error fetching progress steps:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching progress steps'
    });
  }
};

// Get step by ID
exports.getStepById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const step = await ProgressStep.findByPk(id, {
      include: [
        {
          model: ProgressPhase,
          as: 'phase',
          attributes: ['id', 'name', 'description', 'display_order']
        }
      ]
    });
    
    if (!step) {
      return res.status(404).json({
        error: true,
        message: 'Progress step not found'
      });
    }
    
    res.status(200).json(step);
  } catch (error) {
    logger.error('Error fetching progress step:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching progress step'
    });
  }
};

// Create progress step (admin only)
exports.createStep = async (req, res) => {
  try {
    // Only admins can create steps
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can create progress steps'
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
    
    // Verify the phase exists
    const phaseExists = await ProgressPhase.findByPk(req.body.phase_id);
    if (!phaseExists) {
      return res.status(404).json({
        error: true,
        message: 'Progress phase not found'
      });
    }
    
    // Create step
    const step = await ProgressStep.create(req.body);
    
    res.status(201).json(step);
  } catch (error) {
    logger.error('Error creating progress step:', error);
    
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
      message: 'Error creating progress step'
    });
  }
};

// Update progress step (admin only)
exports.updateStep = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can update steps
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can update progress steps'
      });
    }
    
    const step = await ProgressStep.findByPk(id);
    
    if (!step) {
      return res.status(404).json({
        error: true,
        message: 'Progress step not found'
      });
    }
    
    // If changing the phase, verify the new phase exists
    if (req.body.phase_id && req.body.phase_id !== step.phase_id) {
      const phaseExists = await ProgressPhase.findByPk(req.body.phase_id);
      if (!phaseExists) {
        return res.status(404).json({
          error: true,
          message: 'Progress phase not found'
        });
      }
    }
    
    // Update step
    await step.update(req.body);
    
    res.status(200).json(step);
  } catch (error) {
    logger.error('Error updating progress step:', error);
    
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
      message: 'Error updating progress step'
    });
  }
};

// Delete progress step (admin only)
exports.deleteStep = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins can delete steps
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators can delete progress steps'
      });
    }
    
    const step = await ProgressStep.findByPk(id);
    
    if (!step) {
      return res.status(404).json({
        error: true,
        message: 'Progress step not found'
      });
    }
    
    // Check if there are client progress records associated with this step
    const progressCount = await ClientProgress.count({ where: { step_id: id } });
    
    if (progressCount > 0) {
      return res.status(400).json({
        error: true,
        message: 'Cannot delete step with associated client progress records'
      });
    }
    
    // Delete the step
    await step.destroy();
    
    res.status(200).json({
      success: true,
      message: 'Progress step deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting progress step:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting progress step'
    });
  }
};

// Get client progress
exports.getClientProgress = async (req, res) => {
  try {
    const { client_property_id } = req.query;
    
    if (!client_property_id) {
      return res.status(400).json({
        error: true,
        message: 'Client property ID is required'
      });
    }
    
    // Fetch the client property
    const clientProperty = await ClientProperty.findByPk(client_property_id, {
      include: [
        {
          model: Client,
          as: 'client'
        },
        {
          model: Property,
          as: 'property'
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
    if (req.user.role === 'client') {
      // Only allow clients to see their own progress
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client || client.id !== clientProperty.client_id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    } else if (req.user.role === 'advisor') {
      // Only allow advisors to see their clients' progress
      const client = await Client.findByPk(clientProperty.client_id);
      
      if (!client || client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Get all progress steps
    const allSteps = await ProgressStep.findAll({
      include: [
        {
          model: ProgressPhase,
          as: 'phase'
        }
      ],
      order: [
        [{ model: ProgressPhase, as: 'phase' }, 'display_order', 'ASC'],
        ['display_order', 'ASC']
      ]
    });
    
    // Get client progress for this property
    const clientProgress = await ClientProgress.findAll({
      where: { client_property_id },
      include: [
        {
          model: ProgressStep,
          as: 'step',
          include: [
            {
              model: ProgressPhase,
              as: 'phase'
            }
          ]
        }
      ]
    });
    
    // Create a complete progress report
    const progressMap = new Map();
    
    // Initialize with all steps (set as pending by default)
    allSteps.forEach(step => {
      if (!progressMap.has(step.phase.id)) {
        progressMap.set(step.phase.id, {
          phase_id: step.phase.id,
          phase_name: step.phase.name,
          phase_description: step.phase.description,
          phase_display_order: step.phase.display_order,
          steps: []
        });
      }
      
      progressMap.get(step.phase.id).steps.push({
        step_id: step.id,
        step_name: step.name,
        step_description: step.description,
        step_display_order: step.display_order,
        estimated_days: step.estimated_days,
        status: 'pending',
        completion_date: null,
        notes: null,
        progress_id: null
      });
    });
    
    // Update with actual client progress
    clientProgress.forEach(progress => {
      const phaseId = progress.step.phase.id;
      const phase = progressMap.get(phaseId);
      
      if (phase) {
        const stepIndex = phase.steps.findIndex(s => s.step_id === progress.step_id);
        
        if (stepIndex !== -1) {
          phase.steps[stepIndex] = {
            ...phase.steps[stepIndex],
            status: progress.status,
            completion_date: progress.completion_date,
            notes: progress.notes,
            progress_id: progress.id
          };
        }
      }
    });
    
    // Convert to array and sort
    const progressByPhase = Array.from(progressMap.values()).sort((a, b) => a.phase_display_order - b.phase_display_order);
    
    // Calculate overall progress
    const totalSteps = allSteps.length;
    const completedSteps = clientProgress.filter(p => p.status === 'completed').length;
    const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    
    // Determine current phase
    let currentPhase = null;
    if (progressByPhase.length > 0) {
      for (const phase of progressByPhase) {
        const hasInProgress = phase.steps.some(step => step.status === 'in_progress');
        const hasPending = phase.steps.some(step => step.status === 'pending');
        
        if (hasInProgress || hasPending) {
          currentPhase = phase.phase_name;
          break;
        }
      }
      
      // If all steps are completed, set the last phase as current
      if (!currentPhase) {
        currentPhase = progressByPhase[progressByPhase.length - 1].phase_name;
      }
    }
    
    // Update the client property with the calculated progress
    await clientProperty.update({
      overall_progress: overallProgress,
      current_phase: currentPhase
    });
    
    // Return the progress report
    res.status(200).json({
      client_property: {
        id: clientProperty.id,
        client_id: clientProperty.client_id,
        property_id: clientProperty.property_id,
        property_name: clientProperty.property.name,
        status: clientProperty.status,
        overall_progress: overallProgress,
        current_phase: currentPhase
      },
      progress_by_phase: progressByPhase
    });
  } catch (error) {
    logger.error('Error fetching client progress:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching client progress'
    });
  }
};

// Update client progress
exports.updateClientProgress = async (req, res) => {
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
    
    const { client_property_id, step_id, status, completion_date, notes } = req.body;
    
    // Verify the client property exists
    const clientProperty = await ClientProperty.findByPk(client_property_id, {
      include: [
        {
          model: Client,
          as: 'client'
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
    if (req.user.role === 'client') {
      // Clients can't update progress
      return res.status(403).json({
        error: true,
        message: 'Clients cannot update progress'
      });
    } else if (req.user.role === 'advisor') {
      // Only allow advisors to update their clients' progress
      const client = await Client.findByPk(clientProperty.client_id);
      
      if (!client || client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Verify the step exists
    const step = await ProgressStep.findByPk(step_id);
    if (!step) {
      return res.status(404).json({
        error: true,
        message: 'Progress step not found'
      });
    }
    
    // Check if the progress record already exists
    let progress = await ClientProgress.findOne({
      where: {
        client_property_id,
        step_id
      }
    });
    
    // Update or create progress record
    if (progress) {
      await progress.update({
        status,
        completion_date: status === 'completed' && !completion_date ? new Date() : completion_date,
        notes
      });
    } else {
      progress = await ClientProgress.create({
        client_property_id,
        step_id,
        status,
        completion_date: status === 'completed' ? new Date() : null,
        notes
      });
    }
    
    // Recalculate overall progress
    const allSteps = await ProgressStep.count();
    const completedSteps = await ClientProgress.count({
      where: {
        client_property_id,
        status: 'completed'
      }
    });
    
    const overallProgress = allSteps > 0 ? Math.round((completedSteps / allSteps) * 100) : 0;
    
    // Determine current phase
    const currentProgressStep = await ProgressStep.findAll({
      include: [
        {
          model: ProgressPhase,
          as: 'phase'
        },
        {
          model: ClientProgress,
          as: 'clientSteps',
          where: {
            client_property_id,
            status: { [Op.in]: ['in_progress', 'pending'] }
          },
          required: true
        }
      ],
      order: [
        [{ model: ProgressPhase, as: 'phase' }, 'display_order', 'ASC'],
        ['display_order', 'ASC']
      ],
      limit: 1
    });
    
    let currentPhase = null;
    if (currentProgressStep.length > 0) {
      currentPhase = currentProgressStep[0].phase.name;
    } else {
      // If all steps are completed, get the last phase
      const lastPhase = await ProgressPhase.findOne({
        order: [['display_order', 'DESC']],
        limit: 1
      });
      
      if (lastPhase) {
        currentPhase = lastPhase.name;
      }
    }
    
    // Update the client property with the calculated progress
    await clientProperty.update({
      overall_progress: overallProgress,
      current_phase: currentPhase
    });
    
    res.status(200).json({
      success: true,
      message: 'Progress updated successfully',
      progress,
      client_property: {
        overall_progress: overallProgress,
        current_phase: currentPhase
      }
    });
  } catch (error) {
    logger.error('Error updating client progress:', error);
    
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
      message: 'Error updating client progress'
    });
  }
};

// Get client property progress by client and property IDs
exports.getClientPropertyProgress = async (req, res) => {
  try {
    const { client_id, property_id } = req.params;
    
    // Find the client property
    const clientProperty = await ClientProperty.findOne({
      where: {
        client_id,
        property_id
      },
      include: [
        {
          model: Client,
          as: 'client'
        },
        {
          model: Property,
          as: 'property'
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
    if (req.user.role === 'client') {
      // Only allow clients to see their own progress
      const client = await Client.findOne({
        where: { user_id: req.user.id }
      });
      
      if (!client || client.id !== clientProperty.client_id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    } else if (req.user.role === 'advisor') {
      // Only allow advisors to see their clients' progress
      const client = await Client.findByPk(clientProperty.client_id);
      
      if (!client || client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Get all progress steps
    const allSteps = await ProgressStep.findAll({
      include: [
        {
          model: ProgressPhase,
          as: 'phase'
        }
      ],
      order: [
        [{ model: ProgressPhase, as: 'phase' }, 'display_order', 'ASC'],
        ['display_order', 'ASC']
      ]
    });
    
    // Get client progress for this property
    const clientProgress = await ClientProgress.findAll({
      where: { client_property_id: clientProperty.id },
      include: [
        {
          model: ProgressStep,
          as: 'step',
          include: [
            {
              model: ProgressPhase,
              as: 'phase'
            }
          ]
        }
      ]
    });
    
    // Create a complete progress report
    const progressMap = new Map();
    
    // Initialize with all steps (set as pending by default)
    allSteps.forEach(step => {
      if (!progressMap.has(step.phase.id)) {
        progressMap.set(step.phase.id, {
          phase_id: step.phase.id,
          phase_name: step.phase.name,
          phase_description: step.phase.description,
          phase_display_order: step.phase.display_order,
          steps: []
        });
      }
      
      progressMap.get(step.phase.id).steps.push({
        step_id: step.id,
        step_name: step.name,
        step_description: step.description,
        step_display_order: step.display_order,
        estimated_days: step.estimated_days,
        status: 'pending',
        completion_date: null,
        notes: null,
        progress_id: null
      });
    });
    
    // Update with actual client progress
    clientProgress.forEach(progress => {
      const phaseId = progress.step.phase.id;
      const phase = progressMap.get(phaseId);
      
      if (phase) {
        const stepIndex = phase.steps.findIndex(s => s.step_id === progress.step_id);
        
        if (stepIndex !== -1) {
          phase.steps[stepIndex] = {
            ...phase.steps[stepIndex],
            status: progress.status,
            completion_date: progress.completion_date,
            notes: progress.notes,
            progress_id: progress.id
          };
        }
      }
    });
    
    // Convert to array and sort
    const progressByPhase = Array.from(progressMap.values()).sort((a, b) => a.phase_display_order - b.phase_display_order);
    
    // Calculate overall progress
    const totalSteps = allSteps.length;
    const completedSteps = clientProgress.filter(p => p.status === 'completed').length;
    const overallProgress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;
    
    // Return the progress report
    res.status(200).json({
      client_property: {
        id: clientProperty.id,
        client_id: clientProperty.client_id,
        client_name: `${clientProperty.client.first_name} ${clientProperty.client.last_name}`,
        property_id: clientProperty.property_id,
        property_name: clientProperty.property.name,
        status: clientProperty.status,
        overall_progress: overallProgress,
        current_phase: clientProperty.current_phase
      },
      progress: progressByPhase,
      completion_percentage: overallProgress
    });
  } catch (error) {
    logger.error('Error fetching client property progress:', error);
    res.status(500).json({
      error: true,
      message: 'Error fetching client property progress'
    });
  }
};

// Update client progress by ID
exports.updateClientProgressById = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes, completion_date } = req.body;
    
    // Only admins and advisors can update progress
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can update progress records'
      });
    }
    
    const progress = await ClientProgress.findByPk(id, {
      include: [
        {
          model: ClientProperty,
          as: 'clientProperty',
          include: [
            {
              model: Client,
              as: 'client'
            }
          ]
        },
        {
          model: ProgressStep,
          as: 'step'
        }
      ]
    });
    
    if (!progress) {
      return res.status(404).json({
        error: true,
        message: 'Progress record not found'
      });
    }
    
    // Advisors can only update their clients' progress
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(progress.clientProperty.client_id);
      
      if (!client || client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    // Update the progress record
    await progress.update({
      status,
      completion_date: status === 'completed' && !completion_date ? new Date() : completion_date,
      notes: notes !== undefined ? notes : progress.notes
    });
    
    // Recalculate overall progress for the client property
    const clientPropertyId = progress.client_property_id;
    
    // Get total steps count
    const allSteps = await ProgressStep.count();
    
    // Get completed steps count
    const completedSteps = await ClientProgress.count({
      where: {
        client_property_id: clientPropertyId,
        status: 'completed'
      }
    });
    
    // Calculate overall progress percentage
    const overallProgress = allSteps > 0 ? Math.round((completedSteps / allSteps) * 100) : 0;
    
    // Determine current phase
    const currentProgressStep = await ProgressStep.findAll({
      include: [
        {
          model: ProgressPhase,
          as: 'phase'
        },
        {
          model: ClientProgress,
          as: 'clientSteps',
          where: {
            client_property_id: clientPropertyId,
            status: { [Op.in]: ['in_progress', 'pending'] }
          },
          required: true
        }
      ],
      order: [
        [{ model: ProgressPhase, as: 'phase' }, 'display_order', 'ASC'],
        ['display_order', 'ASC']
      ],
      limit: 1
    });
    
    let currentPhase = null;
    if (currentProgressStep.length > 0) {
      currentPhase = currentProgressStep[0].phase.name;
    } else {
      // If all steps are completed, get the last phase
      const lastPhase = await ProgressPhase.findOne({
        order: [['display_order', 'DESC']],
        limit: 1
      });
      
      if (lastPhase) {
        currentPhase = lastPhase.name;
      }
    }
    
    // Update the client property with the calculated progress
    await ClientProperty.update(
      {
        overall_progress: overallProgress,
        current_phase: currentPhase
      },
      {
        where: { id: clientPropertyId }
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Progress record updated successfully',
      progress: {
        id: progress.id,
        client_property_id: progress.client_property_id,
        step_id: progress.step_id,
        status: progress.status,
        completion_date: progress.completion_date,
        notes: progress.notes
      },
      client_property: {
        overall_progress: overallProgress,
        current_phase: currentPhase
      }
    });
  } catch (error) {
    logger.error('Error updating client progress:', error);
    
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
      message: 'Error updating client progress'
    });
  }
};

// Delete client progress
exports.deleteClientProgress = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Only admins and advisors can delete progress
    if (req.user.role !== 'admin' && req.user.role !== 'advisor') {
      return res.status(403).json({
        error: true,
        message: 'Only administrators and advisors can delete progress records'
      });
    }
    
    const progress = await ClientProgress.findByPk(id, {
      include: [
        {
          model: ClientProperty,
          as: 'clientProperty',
          include: [
            {
              model: Client,
              as: 'client'
            }
          ]
        }
      ]
    });
    
    if (!progress) {
      return res.status(404).json({
        error: true,
        message: 'Progress record not found'
      });
    }
    
    // Advisors can only delete their clients' progress
    if (req.user.role === 'advisor') {
      const client = await Client.findByPk(progress.clientProperty.client_id);
      
      if (!client || client.advisor_id !== req.user.id) {
        return res.status(403).json({
          error: true,
          message: 'Access denied'
        });
      }
    }
    
    const clientPropertyId = progress.client_property_id;
    
    // Delete the progress record
    await progress.destroy();
    
    // Recalculate overall progress
    const allSteps = await ProgressStep.count();
    const completedSteps = await ClientProgress.count({
      where: {
        client_property_id: clientPropertyId,
        status: 'completed'
      }
    });
    
    const overallProgress = allSteps > 0 ? Math.round((completedSteps / allSteps) * 100) : 0;
    
    // Update the client property
    await ClientProperty.update(
      {
        overall_progress: overallProgress
      },
      {
        where: { id: clientPropertyId }
      }
    );
    
    res.status(200).json({
      success: true,
      message: 'Progress record deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting client progress:', error);
    res.status(500).json({
      error: true,
      message: 'Error deleting client progress'
    });
  }
};
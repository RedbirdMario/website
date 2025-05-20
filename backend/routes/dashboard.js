const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Get dashboard data (requires authentication)
router.get('/', protect, dashboardController.getDashboardData);

module.exports = router;
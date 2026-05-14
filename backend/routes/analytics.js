const express = require('express');
const {
  getTrends,
  getDistrictSymptomTrends,
  getDashboardMetrics,
} = require('../controllers/analyticsController');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

router.get('/trends', getTrends);
router.get('/district-trends', protect, authorize('admin'), getDistrictSymptomTrends);
router.get('/dashboard', protect, authorize('admin'), getDashboardMetrics);

module.exports = router;

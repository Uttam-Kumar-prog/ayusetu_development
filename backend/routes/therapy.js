const express = require('express');
const { body, param } = require('express-validator');
const {
  createTherapyPlan,
  getMyTherapyPlans,
  markSessionStatus,
} = require('../controllers/therapyController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post(
  '/',
  protect,
  authorize('doctor', 'admin'),
  body('patientId').isMongoId().withMessage('patientId must be a valid id'),
  body('therapyType').isString().trim().notEmpty().withMessage('therapyType is required'),
  body('startDate').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('startDate must be in YYYY-MM-DD format'),
  body('totalSessions').optional().isInt({ min: 1, max: 60 }).withMessage('totalSessions must be between 1 and 60'),
  validate,
  createTherapyPlan
);
router.get('/mine', protect, authorize('patient', 'doctor', 'admin'), getMyTherapyPlans);
router.patch(
  '/:id/session',
  protect,
  authorize('doctor', 'admin'),
  param('id').isMongoId().withMessage('id must be a valid therapy plan id'),
  body('sessionDay').isInt({ min: 1 }).withMessage('sessionDay must be at least 1'),
  body('status').isIn(['PENDING', 'COMPLETED', 'SKIPPED']).withMessage('invalid session status'),
  body('notes').optional().isString().isLength({ max: 3000 }).withMessage('notes is too long'),
  validate,
  markSessionStatus
);

module.exports = router;

const express = require('express');
const { body, param } = require('express-validator');
const {
  submitSymptoms,
  getMySymptomHistory,
  getSymptomAssessmentById,
} = require('../controllers/symptomController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');
const router = express.Router();

router.post(
  '/submit',
  protect,
  body('symptoms').isArray({ min: 1 }).withMessage('symptoms must be a non-empty array'),
  body('symptoms.*.name').isString().trim().notEmpty().withMessage('symptom name is required'),
  body('symptoms.*.severity').isInt({ min: 1, max: 3 }).withMessage('symptom severity must be between 1 and 3'),
  body('lifestyle').optional().isString().withMessage('lifestyle must be a string'),
  body('language').optional().isIn(['en', 'hi', 'pa']).withMessage('invalid language'),
  body('inputMode').optional().isIn(['text', 'voice']).withMessage('invalid inputMode'),
  validate,
  submitSymptoms
);
router.get('/history', protect, getMySymptomHistory);
router.get(
  '/:id',
  protect,
  param('id').isMongoId().withMessage('id must be a valid assessment id'),
  validate,
  getSymptomAssessmentById
);

module.exports = router;

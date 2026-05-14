const express = require('express');
const { body, param, query } = require('express-validator');
const {
  listDoctors,
  listDoctorSpecialties,
  getDoctorById,
  updateDoctorProfile,
  upsertAvailability,
  getDoctorAvailability,
} = require('../controllers/doctorController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.get(
  '/',
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),
  query('specialty').optional().isString().withMessage('specialty must be a string'),
  query('location').optional().isString().withMessage('location must be a string'),
  query('language').optional().isString().withMessage('language must be a string'),
  query('search').optional().isString().withMessage('search must be a string'),
  query('minExperience').optional().isInt({ min: 0 }).withMessage('minExperience must be at least 0'),
  validate,
  listDoctors
);
router.get('/specialties', listDoctorSpecialties);
router.get(
  '/:id',
  param('id').isMongoId().withMessage('id must be a valid doctor id'),
  validate,
  getDoctorById
);
router.get(
  '/:id/availability',
  param('id').isMongoId().withMessage('id must be a valid doctor id'),
  query('date').optional().matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be in YYYY-MM-DD format'),
  validate,
  getDoctorAvailability
);
router.patch(
  '/me/profile',
  protect,
  authorize('doctor'),
  body().custom((value) => {
    const allowedKeys = [
      'specialty',
      'experienceYears',
      'qualifications',
      'languages',
      'consultationFee',
      'location',
      'bio',
      'rating',
    ];

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('request body must be an object');
    }

    const invalidKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key));
    if (invalidKeys.length > 0) {
      throw new Error(`invalid profile fields: ${invalidKeys.join(', ')}`);
    }

    return true;
  }),
  body('specialty').optional().isString().trim().notEmpty().withMessage('specialty must be a non-empty string'),
  body('experienceYears').optional().isInt({ min: 0 }).withMessage('experienceYears must be at least 0'),
  body('qualifications').optional().isArray().withMessage('qualifications must be an array'),
  body('qualifications.*').optional().isString().withMessage('qualifications entries must be strings'),
  body('languages').optional().isArray().withMessage('languages must be an array'),
  body('languages.*').optional().isString().withMessage('languages entries must be strings'),
  body('consultationFee').optional().isFloat({ min: 0 }).withMessage('consultationFee must be at least 0'),
  body('location').optional().isString().withMessage('location must be a string'),
  body('bio').optional().isString().isLength({ max: 3000 }).withMessage('bio is too long'),
  body('rating').optional().isFloat({ min: 0, max: 5 }).withMessage('rating must be between 0 and 5'),
  validate,
  updateDoctorProfile
);
router.put(
  '/me/availability',
  protect,
  authorize('doctor'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be in YYYY-MM-DD format'),
  body('timezone').optional().isString().trim().notEmpty().withMessage('timezone must be a non-empty string'),
  body('slots').isArray({ min: 1 }).withMessage('slots must be a non-empty array'),
  body('slots.*.time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('slot time must be in HH:mm format'),
  validate,
  upsertAvailability
);

module.exports = router;

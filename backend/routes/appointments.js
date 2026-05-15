const express = require('express');
const { body, param } = require('express-validator');
const {
  bookAppointment, listMyAppointments, updateAppointmentStatus,
  startConsultation, remindPatient, getMeetingRoomAccess,
  getDoctorCaseSummary, structureAppointmentSymptoms,
  publishRoomSignal, getRoomSignals,
  createAppointmentPaymentOrder, verifyAppointmentPaymentAndBook,
} = require('../controllers/appointmentController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post('/',
  protect, authorize('patient', 'admin'),
  body('doctorId').isMongoId().withMessage('doctorId must be a valid id'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('time must be HH:mm'),
  body('consultationType').optional().isIn(['telemedicine','ayurveda','followup']).withMessage('invalid consultationType'),
  body('symptomSummary').optional().isString().isLength({ max: 2000 }),
  validate, bookAppointment);

router.post('/payment/order',
  protect, authorize('patient', 'admin'),
  body('doctorId').isMongoId().withMessage('doctorId must be a valid id'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD'),
  body('time').matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('time must be HH:mm'),
  body('consultationType').optional().isIn(['telemedicine','ayurveda','followup']).withMessage('invalid consultationType'),
  body('symptomSummary').optional().isString().isLength({ max: 2000 }),
  validate, createAppointmentPaymentOrder);

router.post('/payment/verify',
  protect, authorize('patient', 'admin'),
  body('paymentIntentId').isMongoId().withMessage('paymentIntentId must be a valid id'),
  body('razorpayOrderId').isString().trim().notEmpty().withMessage('razorpayOrderId is required'),
  body('razorpayPaymentId').isString().trim().notEmpty().withMessage('razorpayPaymentId is required'),
  body('razorpaySignature').isString().trim().notEmpty().withMessage('razorpaySignature is required'),
  validate, verifyAppointmentPaymentAndBook);

router.get('/mine', protect, authorize('patient','doctor','admin'), listMyAppointments);

router.get('/room/:roomId/access',
  protect,
  param('roomId').isString().trim().notEmpty().isLength({ min: 6, max: 120 }),
  validate, getMeetingRoomAccess);

router.get('/room/:roomId/signals',
  protect,
  param('roomId').isString().trim().notEmpty().isLength({ min: 6, max: 120 }),
  validate, getRoomSignals);

router.post('/room/:roomId/signal',
  protect,
  param('roomId').isString().trim().notEmpty().isLength({ min: 6, max: 120 }),
  body('type').isIn([
    'peer-joined',
    'peer-left',
    'presence-heartbeat',
    'call-started',
    'call-ended',
    'media-state-changed',
    'webrtc-offer',
    'webrtc-answer',
    'webrtc-ice-candidate',
  ]).withMessage('Invalid signal type'),
  body('payload').optional().isObject().withMessage('payload must be an object'),
  validate, publishRoomSignal);

router.patch('/:id/status',
  protect,
  param('id').isMongoId(),
  body('status').optional().isIn(['CONFIRMED','IN_PROGRESS','COMPLETED','CANCELLED','NO_SHOW']),
  body('notesByDoctor').optional().isString().isLength({ max: 3000 }),
  body('cancelReason').optional().isString().isLength({ max: 1000 }),
  validate, updateAppointmentStatus);

router.post('/:id/start',
  protect, authorize('doctor'),
  param('id').isMongoId(), validate, startConsultation);

router.post('/:id/remind-patient',
  protect, authorize('doctor','admin'),
  param('id').isMongoId(), validate, remindPatient);

router.get('/:id/case-summary',
  protect, authorize('doctor','admin'),
  param('id').isMongoId(), validate, getDoctorCaseSummary);

router.post('/:id/structure-symptoms',
  protect, authorize('doctor','admin'),
  param('id').isMongoId(), validate, structureAppointmentSymptoms);

module.exports = router;

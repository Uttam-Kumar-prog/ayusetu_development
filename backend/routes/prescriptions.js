const express = require('express');
const { body, param } = require('express-validator');
const { createPrescription, getMyPrescriptions, getByAppointment, getPrescriptionByQr } = require('../controllers/prescriptionController');
const { protect, authorize } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

router.post('/',
  protect, authorize('doctor','admin'),
  body('appointmentId').isMongoId(),
  body('diagnosis').optional().isArray(),
  body('diagnosis.*').optional().isString(),
  body('medicines').isArray({ min: 1 }),
  body('medicines.*.name').isString().trim().notEmpty(),
  body('medicines.*.dose').isString().trim().notEmpty(),
  body('medicines.*.frequency').isString().trim().notEmpty(),
  body('medicines.*.duration').isString().trim().notEmpty(),
  body('medicines.*.instructions').optional().isString(),
  body('advice').optional().isString().isLength({ max: 3000 }),
  body('followUpDate').optional({ nullable: true }).isISO8601(),
  validate, createPrescription);

router.get('/mine', protect, authorize('patient','doctor','admin'), getMyPrescriptions);

router.get('/appointment/:appointmentId',
  protect,
  param('appointmentId').isMongoId(), validate, getByAppointment);

router.get('/qr/:token',
  protect, authorize('pharmacy','admin','doctor','patient'),
  param('token').isUUID(), validate, getPrescriptionByQr);

module.exports = router;

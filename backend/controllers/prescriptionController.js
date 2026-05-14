const crypto = require('crypto');
const Prescription = require('../models/Prescription');
const Appointment = require('../models/Appointment');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { createNotification } = require('../services/notificationService');
const email = require('../services/emailService');

// POST /api/prescriptions
exports.createPrescription = asyncHandler(async (req, res) => {
  const { appointmentId, diagnosis = [], medicines = [], advice = '', followUpDate = null } = req.body;

  if (!appointmentId) throw new ApiError(400, 'appointmentId is required');
  if (!Array.isArray(medicines) || medicines.length === 0) throw new ApiError(400, 'At least one medicine is required');

  const appointment = await Appointment.findById(appointmentId)
    .populate('patientId', 'fullName email phone')
    .populate('doctorId',  'fullName email doctorProfile');

  if (!appointment) throw new ApiError(404, 'Appointment not found');
  if (String(appointment.doctorId._id) !== String(req.user._id) && req.user.role !== 'admin')
    throw new ApiError(403, 'Only the assigned doctor can create a prescription');

  // Upsert: if one already exists, update it
  const existing = await Prescription.findOne({ appointmentId });
  let prescription;

  if (existing) {
    existing.diagnosis   = diagnosis;
    existing.medicines   = medicines;
    existing.advice      = advice;
    if (followUpDate !== null) existing.followUpDate = followUpDate;
    await existing.save();
    prescription = existing;
  } else {
    prescription = await Prescription.create({
      appointmentId,
      patientId:  appointment.patientId._id,
      doctorId:   appointment.doctorId._id,
      diagnosis, medicines, advice, followUpDate,
      qrToken: crypto.randomUUID(),
    });
  }

  const patient = appointment.patientId;
  const doctor  = appointment.doctorId;

  Promise.allSettled([
    createNotification({ userId: patient._id, type: 'PRESCRIPTION_ISSUED',
      title: 'Prescription issued', body: `Dr. ${doctor.fullName} issued a prescription for your consultation.` }),
    email.prescriptionIssuedToPatient({ patient, doctor, appt: appointment, rx: prescription }),
  ]);

  return res.status(existing ? 200 : 201).json({ success: true, prescription });
});

// GET /api/prescriptions/mine
exports.getMyPrescriptions = asyncHandler(async (req, res) => {
  let query = { patientId: req.user._id };
  if (req.user.role === 'doctor') query = { doctorId: req.user._id };
  if (req.user.role === 'admin')  query = {};

  const prescriptions = await Prescription.find(query)
    .populate('doctorId',      'fullName doctorProfile.specialty')
    .populate('patientId',     'fullName')
    .populate('appointmentId', 'slotDate slotTime consultationType symptomSummary')
    .sort({ createdAt: -1 });

  return res.json({ success: true, count: prescriptions.length, prescriptions });
});

// GET /api/prescriptions/appointment/:appointmentId
exports.getByAppointment = asyncHandler(async (req, res) => {
  const { appointmentId } = req.params;
  const rx = await Prescription.findOne({ appointmentId })
    .populate('doctorId',      'fullName doctorProfile.specialty')
    .populate('patientId',     'fullName')
    .populate('appointmentId', 'slotDate slotTime consultationType');

  if (!rx) throw new ApiError(404, 'No prescription found for this appointment');

  const canView = req.user.role === 'admin'
    || String(rx.patientId._id) === String(req.user._id)
    || String(rx.doctorId._id)  === String(req.user._id);
  if (!canView) throw new ApiError(403, 'Access denied');

  return res.json({ success: true, prescription: rx });
});

// GET /api/prescriptions/qr/:token
exports.getPrescriptionByQr = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const rx = await Prescription.findOne({ qrToken: token })
    .populate('doctorId',  'fullName doctorProfile.specialty')
    .populate('patientId', 'fullName');
  if (!rx) throw new ApiError(404, 'Prescription not found');
  return res.json({ success: true, prescription: rx });
});

const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const SymptomHistory = require('../models/SymptomHistory');
const PatientSymptomMemory = require('../models/PatientSymptomMemory');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { createNotification } = require('../services/notificationService');
const email = require('../services/emailService');
const { structureSymptoms } = require('../services/aiSymptomService');

const genCode = () => `APT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;

// POST /api/appointments
exports.bookAppointment = asyncHandler(async (req, res) => {
  const { doctorId, date, time, consultationType = 'telemedicine', symptomSummary = '' } = req.body;

  if (!doctorId || !date || !time) throw new ApiError(400, 'doctorId, date and time are required');

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
  if (!doctor) throw new ApiError(404, 'Doctor not found');

  const lock = await DoctorAvailability.findOneAndUpdate(
    { doctorId, date, 'slots.time': time, 'slots.status': 'AVAILABLE' },
    { $set: { 'slots.$.status': 'BOOKED', 'slots.$.bookedBy': req.user._id } },
    { new: true }
  );
  if (!lock) throw new ApiError(409, 'Slot no longer available. Please choose another.');

  const selectedSlot = lock.slots.find(s => s.time === time);
  const roomId = `room-${crypto.randomUUID()}`;

  // AI-structure symptoms in background (won't block response)
  let aiSummary = '';
  if (symptomSummary.trim()) {
    try {
      const structured = await structureSymptoms(symptomSummary);
      if (structured?.structuredSummary) aiSummary = structured.structuredSummary;
    } catch {}
  }

  const appointment = await Appointment.create({
    appointmentCode: genCode(),
    patientId: req.user._id,
    doctorId,
    slotDate: date,
    slotTime: time,
    startAt: selectedSlot.startAt,
    endAt: selectedSlot.endAt,
    consultationType,
    symptomSummary,
    aiSymptomSummary: aiSummary,
    meeting: { roomId, joinUrl: `${process.env.WEB_URL || 'http://localhost:5173'}/consultation/${roomId}` },
  });

  await DoctorAvailability.updateOne(
    { doctorId, date, 'slots.time': time },
    { $set: { 'slots.$.appointmentId': appointment._id } }
  );

  const patient = req.user;
  const displaySummary = aiSummary || symptomSummary;

  // Notifications fire-and-forget
  Promise.allSettled([
    createNotification({ userId: patient._id, type: 'APPOINTMENT_CONFIRMED', title: 'Appointment booked',
      body: `Consultation with Dr. ${doctor.fullName} on ${date} at ${time}` }),
    createNotification({ userId: doctor._id, type: 'NEW_APPOINTMENT', title: 'New appointment',
      body: `${patient.fullName} booked on ${date} at ${time}` }),
    email.bookingConfirmToPatient({ patient, doctor, appt: appointment }),
    email.bookingNotifyDoctor({ patient, doctor, appt: appointment, symptomSummary: displaySummary }),
  ]);

  return res.status(201).json({ success: true, message: 'Appointment booked successfully', appointment });
});

// GET /api/appointments/mine
exports.listMyAppointments = asyncHandler(async (req, res) => {
  let query = {};
  if (req.user.role === 'patient')      query = { patientId: req.user._id };
  else if (req.user.role === 'doctor')  query = { doctorId:  req.user._id };
  else if (req.user.role !== 'admin')   throw new ApiError(403, 'Not allowed');

  const appointments = await Appointment.find(query)
    .populate('patientId', 'fullName phone email')
    .populate('doctorId',  'fullName doctorProfile.specialty email')
    .sort({ startAt: -1 });

  return res.json({ success: true, count: appointments.length, appointments });
});

// PATCH /api/appointments/:id/status
exports.updateAppointmentStatus = asyncHandler(async (req, res) => {
  const { status, notesByDoctor = '', cancelReason = '' } = req.body;
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new ApiError(404, 'Appointment not found');

  const allowed = req.user.role === 'admin'
    || String(appointment.patientId) === String(req.user._id)
    || String(appointment.doctorId)  === String(req.user._id);
  if (!allowed) throw new ApiError(403, 'Access denied');

  if (status)        appointment.status       = status;
  if (notesByDoctor) appointment.notesByDoctor = notesByDoctor;
  if (cancelReason)  appointment.cancelReason  = cancelReason;
  await appointment.save();

  return res.json({ success: true, appointment });
});

// POST /api/appointments/:id/start  (doctor only)
exports.startConsultation = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patientId', 'fullName email phone')
    .populate('doctorId',  'fullName email');

  if (!appointment) throw new ApiError(404, 'Appointment not found');
  if (String(appointment.doctorId._id) !== String(req.user._id))
    throw new ApiError(403, 'Only the assigned doctor can start this consultation');

  appointment.status = 'IN_PROGRESS';
  await appointment.save();

  const patient = appointment.patientId;
  const doctor  = appointment.doctorId;

  Promise.allSettled([
    createNotification({ userId: patient._id, type: 'CALL_STARTED',
      title: 'Doctor has started the consultation',
      body: `Dr. ${doctor.fullName} has started your video consultation. Please join now.`,
      payload: { joinUrl: appointment.meeting.joinUrl } }),
    email.doctorStartedCall({ patient, doctor, appt: appointment }),
  ]);

  return res.json({ success: true, message: 'Consultation started. Patient notified.', appointment });
});

// POST /api/appointments/:id/remind-patient  (doctor only)
exports.remindPatient = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patientId', 'fullName email phone')
    .populate('doctorId',  'fullName email');

  if (!appointment) throw new ApiError(404, 'Appointment not found');
  if (String(appointment.doctorId._id) !== String(req.user._id) && req.user.role !== 'admin')
    throw new ApiError(403, 'Only the assigned doctor can send reminders');

  const patient = appointment.patientId;
  const doctor  = appointment.doctorId;

  await Promise.allSettled([
    email.manualReminderToPatient({ patient, doctor, appt: appointment }),
    createNotification({ userId: patient._id, type: 'MANUAL_REMINDER',
      title: `Reminder from Dr. ${doctor.fullName}`,
      body: 'Your doctor is waiting. Please join the consultation.',
      payload: { joinUrl: appointment.meeting.joinUrl } }),
  ]);

  return res.json({ success: true, message: 'Reminder sent to patient.' });
});

// GET /api/appointments/room/:roomId/access
exports.getMeetingRoomAccess = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const appointment = await Appointment.findOne({ 'meeting.roomId': roomId })
    .populate('patientId', 'fullName')
    .populate('doctorId',  'fullName');

  if (!appointment) throw new ApiError(404, 'Consultation room not found');

  const isAdmin  = req.user.role === 'admin';
  const isDoctor = String(appointment.doctorId?._id  || appointment.doctorId)  === String(req.user._id);
  const isPatient= String(appointment.patientId?._id || appointment.patientId) === String(req.user._id);
  if (!isAdmin && !isDoctor && !isPatient) throw new ApiError(403, 'Not authorized to join this consultation');

  const now          = Date.now();
  const startMs      = new Date(appointment.startAt).getTime();
  const endMs        = new Date(appointment.endAt).getTime();
  const windowStart  = startMs - 20 * 60000;
  const windowEnd    = endMs   + 90 * 60000;
  const blocked      = ['CANCELLED','NO_SHOW'].includes(String(appointment.status).toUpperCase());
  const insideWindow = now >= windowStart && now <= windowEnd;
  const canJoinNow   = !blocked && insideWindow;

  const reason = blocked
    ? `Meeting unavailable — appointment is ${appointment.status}.`
    : insideWindow ? 'Meeting is active.'
    : now < windowStart ? 'Room opens 20 minutes before scheduled time.'
    : 'Meeting window has passed.';

  return res.json({
    success: true,
    access: { canJoinNow, reason, now: new Date(now).toISOString(),
      windowStart: new Date(windowStart).toISOString(), windowEnd: new Date(windowEnd).toISOString() },
    appointment: {
      id: appointment._id, status: appointment.status,
      slotDate: appointment.slotDate, slotTime: appointment.slotTime,
      consultationType: appointment.consultationType,
      startAt: appointment.startAt, endAt: appointment.endAt,
      meeting: appointment.meeting,
      doctorName:  appointment?.doctorId?.fullName  || '',
      patientName: appointment?.patientId?.fullName || '',
      userRole: isDoctor ? 'doctor' : isPatient ? 'patient' : 'admin',
    },
  });
});

// GET /api/appointments/:id/case-summary  (doctor only)
exports.getDoctorCaseSummary = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('patientId', 'fullName phone profile')
    .populate('doctorId',  'fullName');

  if (!appointment) throw new ApiError(404, 'Appointment not found');
  if (String(appointment.doctorId._id) !== String(req.user._id) && req.user.role !== 'admin')
    throw new ApiError(403, 'Access denied');

  const [assessments, memory] = await Promise.all([
    SymptomHistory.find({ userId: appointment.patientId._id }).sort({ createdAt: -1 }).limit(5),
    PatientSymptomMemory.findOne({ userId: appointment.patientId._id }),
  ]);

  return res.json({
    success: true,
    summary: {
      appointment,
      recentAssessments: assessments,
      symptomMemory: memory ? {
        topSymptoms: memory.topSymptoms || [],
        likelyCauses: memory.likelyCauses || [],
        lastAssistantName: memory.lastAssistantName || 'AyuBot',
        recentConversationSignals: (memory.entries || []).slice(-10).reverse().map(e => ({
          source: e.source, assistantName: e.assistantName,
          symptoms: e.symptoms || [], medications: e.medications || [],
          createdAt: e.createdAt, snippet: String(e.rawText || '').slice(0, 280),
        })),
      } : null,
    },
  });
});

// POST /api/appointments/:id/structure-symptoms  (doctor can trigger AI re-structuring)
exports.structureAppointmentSymptoms = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);
  if (!appointment) throw new ApiError(404, 'Appointment not found');
  if (String(appointment.doctorId) !== String(req.user._id) && req.user.role !== 'admin')
    throw new ApiError(403, 'Access denied');

  if (!appointment.symptomSummary)
    return res.json({ success: true, structured: null, message: 'No symptom summary to structure.' });

  const structured = await structureSymptoms(appointment.symptomSummary);
  if (structured?.structuredSummary) {
    appointment.aiSymptomSummary = structured.structuredSummary;
    await appointment.save();
  }

  return res.json({ success: true, structured });
});

const crypto = require('crypto');
const Appointment = require('../models/Appointment');
const AppointmentPayment = require('../models/AppointmentPayment');
const DoctorAvailability = require('../models/DoctorAvailability');
const User = require('../models/User');
const SymptomHistory = require('../models/SymptomHistory');
const PatientSymptomMemory = require('../models/PatientSymptomMemory');
const ConsultationSignal = require('../models/ConsultationSignal');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { createNotification } = require('../services/notificationService');
const email = require('../services/emailService');
const { structureSymptoms } = require('../services/aiSymptomService');
const {
  isRazorpayEnabled,
  createOrder: createRazorpayOrder,
  verifyPaymentSignature,
} = require('../services/razorpayService');

const genCode = () => `APT-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
const paymentExpiryMinutes = Math.max(3, Number(process.env.PAYMENT_ORDER_EXPIRY_MINUTES || 15));

const resolveConsultationFee = (doctor) => {
  const fee = Number(doctor?.doctorProfile?.consultationFee || 0);
  if (!Number.isFinite(fee) || fee < 0) return 0;
  return Math.round(fee);
};

const buildPaymentPayload = ({
  required = false,
  amount = 0,
  currency = 'INR',
  status = 'FREE',
  orderId = '',
  paymentId = '',
  signature = '',
}) => ({
  required,
  provider: required ? 'RAZORPAY' : 'NONE',
  status,
  amount,
  currency,
  orderId,
  paymentId,
  signature,
  paidAt: status === 'PAID' ? new Date() : null,
});

const saveAppointmentAndNotify = async ({
  req,
  doctor,
  date,
  time,
  consultationType,
  symptomSummary,
  payment,
}) => {
  const lock = await DoctorAvailability.findOneAndUpdate(
    { doctorId: doctor._id, date, 'slots.time': time, 'slots.status': 'AVAILABLE' },
    { $set: { 'slots.$.status': 'BOOKED', 'slots.$.bookedBy': req.user._id } },
    { new: true }
  );
  if (!lock) throw new ApiError(409, 'Slot no longer available. Please choose another.');

  const selectedSlot = lock.slots.find((slot) => slot.time === time);
  const roomId = `room-${crypto.randomUUID()}`;

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
    doctorId: doctor._id,
    slotDate: date,
    slotTime: time,
    startAt: selectedSlot.startAt,
    endAt: selectedSlot.endAt,
    consultationType,
    symptomSummary,
    aiSymptomSummary: aiSummary,
    payment,
    meeting: { roomId, joinUrl: `${process.env.WEB_URL || 'http://localhost:5173'}/consultation/${roomId}` },
  });

  await DoctorAvailability.updateOne(
    { doctorId: doctor._id, date, 'slots.time': time },
    { $set: { 'slots.$.appointmentId': appointment._id } }
  );

  const patient = req.user;
  const displaySummary = aiSummary || symptomSummary;

  Promise.allSettled([
    createNotification({
      userId: patient._id,
      type: 'APPOINTMENT_CONFIRMED',
      title: 'Appointment booked',
      body: `Consultation with Dr. ${doctor.fullName} on ${date} at ${time}`,
    }),
    createNotification({
      userId: doctor._id,
      type: 'NEW_APPOINTMENT',
      title: 'New appointment',
      body: `${patient.fullName} booked on ${date} at ${time}`,
    }),
    email.bookingConfirmToPatient({ patient, doctor, appt: appointment }),
    email.bookingNotifyDoctor({ patient, doctor, appt: appointment, symptomSummary: displaySummary }),
  ]);

  return appointment;
};

const resolveMeetingAccess = async (roomId, user) => {
  const appointment = await Appointment.findOne({ 'meeting.roomId': roomId })
    .populate('patientId', 'fullName')
    .populate('doctorId', 'fullName');

  if (!appointment) throw new ApiError(404, 'Consultation room not found');

  const isAdmin = user.role === 'admin';
  const isDoctor = String(appointment.doctorId?._id || appointment.doctorId) === String(user._id);
  const isPatient = String(appointment.patientId?._id || appointment.patientId) === String(user._id);
  if (!isAdmin && !isDoctor && !isPatient) throw new ApiError(403, 'Not authorized to join this consultation');

  const now = Date.now();
  const startMs = new Date(appointment.startAt).getTime();
  const endMs = new Date(appointment.endAt).getTime();
  const windowStart = startMs - 20 * 60000;
  const windowEnd = endMs + 90 * 60000;
  const blocked = ['CANCELLED', 'NO_SHOW'].includes(String(appointment.status).toUpperCase());
  const insideWindow = now >= windowStart && now <= windowEnd;
  const canJoinNow = !blocked && insideWindow;

  const reason = blocked
    ? `Meeting unavailable - appointment is ${appointment.status}.`
    : insideWindow
      ? 'Meeting is active.'
      : now < windowStart
        ? 'Room opens 20 minutes before scheduled time.'
        : 'Meeting window has passed.';

  return {
    appointment,
    isAdmin,
    isDoctor,
    isPatient,
    access: {
      canJoinNow,
      reason,
      now: new Date(now).toISOString(),
      windowStart: new Date(windowStart).toISOString(),
      windowEnd: new Date(windowEnd).toISOString(),
    },
  };
};

// POST /api/appointments
exports.bookAppointment = asyncHandler(async (req, res) => {
  const { doctorId, date, time, consultationType = 'telemedicine', symptomSummary = '' } = req.body;

  if (!doctorId || !date || !time) throw new ApiError(400, 'doctorId, date and time are required');

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true });
  if (!doctor) throw new ApiError(404, 'Doctor not found');
  const consultationFee = resolveConsultationFee(doctor);
  const paymentRequired = consultationFee > 0 && isRazorpayEnabled();
  if (paymentRequired) {
    throw new ApiError(402, 'Payment required. Please complete payment to book this appointment.');
  }

  const appointment = await saveAppointmentAndNotify({
    req,
    doctor,
    date,
    time,
    consultationType,
    symptomSummary,
    payment: buildPaymentPayload({
      required: false,
      amount: consultationFee,
      status: 'FREE',
    }),
  });

  return res.status(201).json({ success: true, message: 'Appointment booked successfully', appointment });
});

// POST /api/appointments/payment/order
exports.createAppointmentPaymentOrder = asyncHandler(async (req, res) => {
  const { doctorId, date, time, consultationType = 'telemedicine', symptomSummary = '' } = req.body;
  if (!doctorId || !date || !time) throw new ApiError(400, 'doctorId, date and time are required');

  const doctor = await User.findOne({ _id: doctorId, role: 'doctor', isActive: true }).select(
    'fullName doctorProfile.consultationFee'
  );
  if (!doctor) throw new ApiError(404, 'Doctor not found');

  const consultationFee = resolveConsultationFee(doctor);
  if (consultationFee <= 0) {
    throw new ApiError(400, 'Doctor consultation fee is not available for online payment.');
  }
  if (!isRazorpayEnabled()) {
    throw new ApiError(503, 'Payment service is currently unavailable.');
  }

  const slotAvailable = await DoctorAvailability.findOne({
    doctorId,
    date,
    slots: { $elemMatch: { time, status: 'AVAILABLE' } },
  }).select('_id');
  if (!slotAvailable) {
    throw new ApiError(409, 'Selected slot is not available. Please choose another slot.');
  }

  const receipt = `apt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const order = await createRazorpayOrder({
    amountPaise: consultationFee * 100,
    currency: 'INR',
    receipt,
    notes: {
      patientId: String(req.user._id),
      doctorId: String(doctor._id),
      slotDate: date,
      slotTime: time,
    },
  });

  const intent = await AppointmentPayment.create({
    patientId: req.user._id,
    doctorId: doctor._id,
    slotDate: date,
    slotTime: time,
    consultationType,
    symptomSummary,
    amount: consultationFee,
    currency: 'INR',
    receipt,
    razorpayOrderId: order.id,
    status: 'CREATED',
    expiresAt: new Date(Date.now() + paymentExpiryMinutes * 60 * 1000),
  });

  return res.status(201).json({
    success: true,
    paymentIntentId: intent._id,
    doctor: { id: doctor._id, fullName: doctor.fullName },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
    },
    expiresAt: intent.expiresAt,
  });
});

// POST /api/appointments/payment/verify
exports.verifyAppointmentPaymentAndBook = asyncHandler(async (req, res) => {
  const {
    paymentIntentId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  } = req.body;

  const intent = await AppointmentPayment.findOne({
    _id: paymentIntentId,
    patientId: req.user._id,
  });
  if (!intent) throw new ApiError(404, 'Payment session not found.');

  if (intent.status === 'VERIFIED') {
    const existingAppointment = await Appointment.findOne({
      patientId: req.user._id,
      doctorId: intent.doctorId,
      slotDate: intent.slotDate,
      slotTime: intent.slotTime,
      'payment.orderId': intent.razorpayOrderId,
    });
    if (existingAppointment) {
      return res.json({
        success: true,
        message: 'Appointment already booked successfully.',
        appointment: existingAppointment,
      });
    }
  }

  if (intent.status !== 'CREATED') {
    throw new ApiError(400, 'This payment session is no longer active.');
  }
  if (intent.expiresAt <= new Date()) {
    intent.status = 'EXPIRED';
    intent.failureReason = 'Payment window expired';
    await intent.save();
    throw new ApiError(400, 'Payment session expired. Please try booking again.');
  }
  if (intent.razorpayOrderId !== razorpayOrderId) {
    throw new ApiError(400, 'Payment order mismatch.');
  }

  const isValidSignature = verifyPaymentSignature({
    orderId: razorpayOrderId,
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });

  if (!isValidSignature) {
    intent.status = 'FAILED';
    intent.failureReason = 'Invalid payment signature';
    await intent.save();
    throw new ApiError(400, 'Payment verification failed.');
  }

  const doctor = await User.findOne({
    _id: intent.doctorId,
    role: 'doctor',
    isActive: true,
  });
  if (!doctor) throw new ApiError(404, 'Doctor not found');

  const appointment = await saveAppointmentAndNotify({
    req,
    doctor,
    date: intent.slotDate,
    time: intent.slotTime,
    consultationType: intent.consultationType,
    symptomSummary: intent.symptomSummary || '',
    payment: buildPaymentPayload({
      required: true,
      amount: intent.amount,
      currency: intent.currency,
      status: 'PAID',
      orderId: razorpayOrderId,
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    }),
  });

  intent.status = 'VERIFIED';
  intent.razorpayPaymentId = razorpayPaymentId;
  intent.razorpaySignature = razorpaySignature;
  await intent.save();

  return res.status(201).json({
    success: true,
    message: 'Payment verified and appointment booked successfully.',
    appointment,
  });
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
  const { appointment, isDoctor, isPatient, access } = await resolveMeetingAccess(roomId, req.user);

  return res.json({
    success: true,
    access,
    appointment: {
      id: appointment._id,
      status: appointment.status,
      slotDate: appointment.slotDate,
      slotTime: appointment.slotTime,
      consultationType: appointment.consultationType,
      startAt: appointment.startAt,
      endAt: appointment.endAt,
      meeting: appointment.meeting,
      doctorName: appointment?.doctorId?.fullName || '',
      patientName: appointment?.patientId?.fullName || '',
      userRole: isDoctor ? 'doctor' : isPatient ? 'patient' : 'admin',
    },
  });
});

// POST /api/appointments/room/:roomId/signal
exports.publishRoomSignal = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { type, payload = {} } = req.body;

  const { appointment, access, isDoctor, isPatient } = await resolveMeetingAccess(roomId, req.user);
  if (!access.canJoinNow) throw new ApiError(403, access.reason || 'Meeting window is closed.');

  const fromRole = isDoctor ? 'doctor' : isPatient ? 'patient' : 'admin';
  const signal = await ConsultationSignal.create({
    roomId,
    appointmentId: appointment._id,
    fromUserId: req.user._id,
    fromRole,
    fromUserName: req.user.fullName || '',
    type,
    payload: payload && typeof payload === 'object' ? payload : {},
  });

  return res.status(201).json({
    success: true,
    signal: {
      id: signal._id,
      roomId: signal.roomId,
      type: signal.type,
      payload: signal.payload,
      fromUserId: String(signal.fromUserId),
      fromUserName: signal.fromUserName,
      fromRole: signal.fromRole,
      createdAt: signal.createdAt,
    },
  });
});

// GET /api/appointments/room/:roomId/signals
exports.getRoomSignals = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const { after } = req.query;
  const requestedLimit = Number(req.query.limit || 60);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 150)) : 60;

  const { appointment, access } = await resolveMeetingAccess(roomId, req.user);
  if (!access.canJoinNow) throw new ApiError(403, access.reason || 'Meeting window is closed.');

  const query = { roomId, appointmentId: appointment._id };
  if (after) {
    const afterDate = new Date(String(after));
    if (!Number.isNaN(afterDate.getTime())) {
      query.createdAt = { $gt: afterDate };
    }
  }

  const signals = await ConsultationSignal.find(query).sort({ createdAt: 1 }).limit(limit);

  return res.json({
    success: true,
    signals: signals.map((signal) => ({
      id: signal._id,
      roomId: signal.roomId,
      type: signal.type,
      payload: signal.payload || {},
      fromUserId: String(signal.fromUserId),
      fromUserName: signal.fromUserName || '',
      fromRole: signal.fromRole,
      createdAt: signal.createdAt,
    })),
    meta: {
      count: signals.length,
      cursor: signals.length ? signals[signals.length - 1].createdAt : after || null,
      doctorName: appointment?.doctorId?.fullName || '',
      patientName: appointment?.patientId?.fullName || '',
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


const mongoose = require('mongoose');
const { APPOINTMENT } = require('../constants/statuses');

const appointmentSchema = new mongoose.Schema(
  {
    appointmentCode: { type: String, required: true, unique: true, index: true },
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slotDate:  { type: String, required: true, index: true },
    slotTime:  { type: String, required: true },
    startAt:   { type: Date, required: true },
    endAt:     { type: Date, required: true },
    consultationType: {
      type: String,
      enum: ['telemedicine', 'ayurveda', 'followup'],
      default: 'telemedicine',
    },
    symptomSummary:   { type: String, default: '' },  // raw patient input
    aiSymptomSummary: { type: String, default: '' },  // AI-structured version
    meeting: {
      type:    { type: String, enum: ['WEBRTC'], default: 'WEBRTC' },
      roomId:  { type: String, required: true },
      joinUrl: { type: String, required: true },
    },
    payment: {
      required: { type: Boolean, default: false },
      provider: { type: String, enum: ['RAZORPAY', 'NONE'], default: 'NONE' },
      status: { type: String, enum: ['FREE', 'PAID', 'PENDING', 'FAILED'], default: 'FREE' },
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
      orderId: { type: String, default: '' },
      paymentId: { type: String, default: '' },
      signature: { type: String, default: '' },
      paidAt: { type: Date, default: null },
    },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT),
      default: APPOINTMENT.CONFIRMED,
      index: true,
    },
    notesByDoctor: { type: String, default: '' },
    cancelReason:  { type: String, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Appointment', appointmentSchema);

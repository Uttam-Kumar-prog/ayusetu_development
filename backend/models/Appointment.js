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

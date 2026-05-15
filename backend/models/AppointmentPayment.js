const mongoose = require('mongoose');

const appointmentPaymentSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slotDate: { type: String, required: true },
    slotTime: { type: String, required: true },
    consultationType: {
      type: String,
      enum: ['telemedicine', 'ayurveda', 'followup'],
      default: 'telemedicine',
    },
    symptomSummary: { type: String, default: '' },
    amount: { type: Number, required: true }, // INR major unit
    currency: { type: String, default: 'INR' },
    receipt: { type: String, required: true, unique: true, index: true },
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    razorpayPaymentId: { type: String, default: '' },
    razorpaySignature: { type: String, default: '' },
    status: {
      type: String,
      enum: ['CREATED', 'VERIFIED', 'FAILED', 'EXPIRED'],
      default: 'CREATED',
      index: true,
    },
    failureReason: { type: String, default: '' },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

appointmentPaymentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('AppointmentPayment', appointmentPaymentSchema);

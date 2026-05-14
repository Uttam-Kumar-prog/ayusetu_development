const mongoose = require('mongoose');
const { SLOT } = require('../constants/statuses');

const slotSchema = new mongoose.Schema(
  {
    time: { type: String, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(SLOT),
      default: SLOT.AVAILABLE,
    },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
  },
  { _id: false }
);

const doctorAvailabilitySchema = new mongoose.Schema(
  {
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: String, required: true, index: true },
    timezone: { type: String, default: 'Asia/Kolkata' },
    slots: [slotSchema],
  },
  { timestamps: true }
);

doctorAvailabilitySchema.index({ doctorId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DoctorAvailability', doctorAvailabilitySchema);

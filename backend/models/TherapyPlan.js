const mongoose = require('mongoose');
const { THERAPY_SESSION } = require('../constants/statuses');

const therapySessionSchema = new mongoose.Schema(
  {
    dayNumber: { type: Number, required: true },
    date: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(THERAPY_SESSION),
      default: THERAPY_SESSION.PENDING,
    },
    notes: { type: String, default: '' },
    completedAt: { type: Date, default: null },
  },
  { _id: false }
);

const therapyPlanSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    therapyType: { type: String, required: true },
    startDate: { type: String, required: true },
    totalSessions: { type: Number, required: true, min: 1 },
    sessions: [therapySessionSchema],
    progressPercent: { type: Number, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'COMPLETED', 'CANCELLED'], default: 'ACTIVE' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TherapyPlan', therapyPlanSchema);

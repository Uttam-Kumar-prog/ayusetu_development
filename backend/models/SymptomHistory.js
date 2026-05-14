const mongoose = require('mongoose');

const symptomHistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    symptoms: [
      {
        name: { type: String, required: true },
        severity: { type: Number, min: 1, max: 3, required: true },
        durationDays: { type: Number, min: 0, default: 0 },
        notes: { type: String, default: '' },
      },
    ],
    lifestyle: { type: String, default: '' },
    language: { type: String, enum: ['en', 'hi', 'pa'], default: 'en' },
    inputMode: { type: String, enum: ['text', 'voice'], default: 'text' },
    triage: {
      doshaImbalance: { type: String, default: '' },
      severityLevel: { type: String, enum: ['mild', 'moderate', 'severe'], default: 'mild' },
      urgency: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'LOW' },
      recommendedSpecialty: { type: String, default: '' },
      unknownSymptoms: { type: [String], default: [] },
      disclaimer: { type: String, default: '' },
    },
    recommendations: { type: [Object], default: [] },
    doshaImbalance: { type: String, default: '' },
    source: { type: String, enum: ['RULES', 'AI'], default: 'RULES' },
    reviewedByDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

symptomHistorySchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('SymptomHistory', symptomHistorySchema);

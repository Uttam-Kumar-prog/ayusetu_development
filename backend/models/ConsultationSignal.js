const mongoose = require('mongoose');

const consultationSignalSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, index: true },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true, index: true },
    fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    fromRole: { type: String, enum: ['doctor', 'patient', 'admin'], required: true },
    fromUserName: { type: String, default: '' },
    type: {
      type: String,
      enum: [
        'peer-joined',
        'peer-left',
        'presence-heartbeat',
        'call-started',
        'call-ended',
        'media-state-changed',
        'webrtc-offer',
        'webrtc-answer',
        'webrtc-ice-candidate',
      ],
      required: true,
      index: true,
    },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

consultationSignalSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 12 });
consultationSignalSchema.index({ roomId: 1, createdAt: 1 });

module.exports = mongoose.model('ConsultationSignal', consultationSignalSchema);

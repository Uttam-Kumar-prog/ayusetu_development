const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    channel: { type: String, enum: ['SMS', 'EMAIL', 'PUSH', 'IN_APP'], default: 'IN_APP' },
    payload: { type: Object, default: {} },
    status: { type: String, enum: ['QUEUED', 'SENT', 'FAILED', 'READ'], default: 'QUEUED' },
    sentAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

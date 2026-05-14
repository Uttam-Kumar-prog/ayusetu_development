const mongoose = require('mongoose');

const otpCodeSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    purpose: {
      type: String,
      enum: ['login', 'register', 'password_reset'],
      default: 'login',
      index: true,
    },
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

otpCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OtpCode', otpCodeSchema);

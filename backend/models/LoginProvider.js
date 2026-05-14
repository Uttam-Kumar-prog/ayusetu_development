const mongoose = require('mongoose');

const loginProviderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    provider: { type: String, enum: ['google', 'local'], required: true, index: true },
    providerUserId: { type: String, default: '', index: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    isPrimary: { type: Boolean, default: false },
    linkedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

loginProviderSchema.index({ provider: 1, providerUserId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('LoginProvider', loginProviderSchema);

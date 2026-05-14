const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const roles = require('../constants/roles');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
  phone: { type: String, unique: true, sparse: true, trim: true },
  password: { type: String, minlength: 6 },
  role: {
    type: String,
    enum: Object.values(roles),
    default: roles.PATIENT,
    index: true,
  },
  isVerified: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  profile: {
    age: { type: Number, min: 0, max: 120 },
    gender: { type: String, enum: ['male', 'female', 'other', 'prefer_not_to_say'] },
    bloodGroup: { type: String },
    languagePreference: {
      type: String,
      enum: ['en', 'hi', 'pa'],
      default: 'en',
    },
    district: { type: String, default: '' },
    address: { type: String, default: '' },
  },
  doctorProfile: {
    specialty: { type: String, default: '' },
    experienceYears: { type: Number, min: 0, default: 0 },
    qualifications: { type: [String], default: [] },
    languages: { type: [String], default: [] },
    consultationFee: { type: Number, min: 0, default: 0 },
    location: { type: String, default: '' },
    bio: { type: String, default: '' },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    verifiedByAdmin: { type: Boolean, default: false },
  },
  pharmacyProfile: {
    storeName: { type: String, default: '' },
    licenseNumber: { type: String, default: '' },
    location: { type: String, default: '' },
  },
  lastLoginAt: { type: Date },
}, { timestamps: true });

// Hash password
userSchema.pre('save', async function (next) {
  if (!this.password || !this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(plainTextPassword) {
  if (!this.password) return false;
  return bcrypt.compare(plainTextPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);

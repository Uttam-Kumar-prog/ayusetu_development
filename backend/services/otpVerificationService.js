const crypto = require('crypto');
const OtpVerification = require('../models/OtpVerification');
const { otpExpiryMinutes, otpResendCooldownSeconds, otpMaxAttempts } = require('../config/auth');

const hashOtp = (otp) => crypto.createHash('sha256').update(String(otp)).digest('hex');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const issueOtp = async ({ userId = null, email, purpose, metadata = {} }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) throw new Error('email is required for OTP');

  const now = new Date();
  const existing = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (existing && existing.resendAvailableAt > now) {
    const waitSeconds = Math.ceil((existing.resendAvailableAt.getTime() - now.getTime()) / 1000);
    return {
      throttled: true,
      waitSeconds,
      expiresAt: existing.expiresAt,
      otpRecord: existing,
    };
  }

  // Ensure only one active OTP per email/purpose at a time.
  // This prevents older codes from being reused after a resend.
  await OtpVerification.updateMany(
    {
      email: normalizedEmail,
      purpose,
      consumedAt: null,
      expiresAt: { $gt: now },
    },
    { $set: { consumedAt: now } }
  );

  const otp = generateOtp();
  const expiresAt = new Date(now.getTime() + otpExpiryMinutes * 60 * 1000);
  const resendAvailableAt = new Date(now.getTime() + otpResendCooldownSeconds * 1000);

  const otpRecord = await OtpVerification.create({
    userId,
    email: normalizedEmail,
    purpose,
    otpHash: hashOtp(otp),
    expiresAt,
    consumedAt: null,
    attempts: 0,
    maxAttempts: otpMaxAttempts,
    resendAvailableAt,
    sentCount: 1,
    metadata,
  });

  return {
    throttled: false,
    otp,
    expiresAt,
    resendAvailableAt,
    otpRecord,
  };
};

const verifyOtp = async ({ email, purpose, otp }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const record = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
  }).sort({ createdAt: -1 });

  if (!record) return { ok: false, reason: 'OTP expired or not found', code: 'OTP_NOT_FOUND' };
  if (record.expiresAt <= new Date()) return { ok: false, reason: 'OTP expired or not found', code: 'OTP_EXPIRED' };

  record.attempts += 1;

  if (record.attempts >= record.maxAttempts) {
    await record.save();
    return { ok: false, reason: 'Maximum OTP attempts reached', code: 'OTP_MAX_ATTEMPTS' };
  }

  if (record.otpHash !== hashOtp(otp)) {
    await record.save();
    return { ok: false, reason: 'Invalid OTP', code: 'OTP_INVALID', attempts: record.attempts };
  }

  record.consumedAt = new Date();
  await record.save();

  return { ok: true, record };
};

const canResendOtp = async ({ email, purpose }) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const now = new Date();
  const record = await OtpVerification.findOne({
    email: normalizedEmail,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (!record) return { allowed: true, waitSeconds: 0 };
  if (record.resendAvailableAt <= now) return { allowed: true, waitSeconds: 0 };
  return { allowed: false, waitSeconds: Math.ceil((record.resendAvailableAt - now) / 1000) };
};

module.exports = {
  issueOtp,
  verifyOtp,
  canResendOtp,
};

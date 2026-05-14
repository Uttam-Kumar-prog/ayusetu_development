const crypto = require('crypto');
const OtpCode = require('../models/OtpCode');

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const issueOtp = async ({ phone, purpose = 'login' }) => {
  await OtpCode.deleteMany({ phone, purpose, consumedAt: null });

  const code = generateOtp();
  const codeHash = hashCode(code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await OtpCode.create({
    phone,
    purpose,
    codeHash,
    expiresAt,
    attempts: 0,
  });

  return {
    code,
    expiresAt,
  };
};

const verifyOtp = async ({ phone, code, purpose = 'login' }) => {
  const otp = await OtpCode.findOne({
    phone,
    purpose,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!otp) {
    return { isValid: false, reason: 'OTP expired or not found' };
  }

  otp.attempts += 1;
  await otp.save();

  if (otp.codeHash !== hashCode(code)) {
    return { isValid: false, reason: 'Invalid OTP' };
  }

  otp.consumedAt = new Date();
  await otp.save();

  return { isValid: true };
};

module.exports = {
  issueOtp,
  verifyOtp,
};

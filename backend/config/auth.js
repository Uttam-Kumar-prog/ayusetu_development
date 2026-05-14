const toNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

module.exports = {
  accessTokenExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshTokenExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  otpExpiryMinutes: toNumber(process.env.OTP_EXPIRY_MINUTES, 5),
  otpResendCooldownSeconds: toNumber(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60),
  otpMaxAttempts: toNumber(process.env.OTP_MAX_ATTEMPTS, 5),
  maxLoginAttempts: toNumber(process.env.MAX_LOGIN_ATTEMPTS, 5),
  accountLockMinutes: toNumber(process.env.ACCOUNT_LOCK_MINUTES, 15),
  resetTokenExpiresMinutes: toNumber(process.env.RESET_TOKEN_EXPIRES_MINUTES, 10),
};

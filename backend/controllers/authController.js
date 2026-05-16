const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const LoginProvider = require('../models/LoginProvider');
const roles = require('../constants/roles');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const {
  signAccessToken,
  signOtpFlowToken,
  signPasswordResetToken,
  verifyToken,
} = require('../utils/jwt');
const { issueOtp, verifyOtp, canResendOtp } = require('../services/otpVerificationService');
const {
  createRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} = require('../services/refreshTokenService');
const { verifyGoogleIdToken } = require('../services/googleAuthService');
const { writeAuditLog } = require('../services/auditLogService');
const emailService = require('../services/emailService');
const {
  maxLoginAttempts,
  accountLockMinutes,
  otpExpiryMinutes,
  otpResendCooldownSeconds,
} = require('../config/auth');

const PUBLIC_REGISTRATION_ROLES = new Set([roles.PATIENT, roles.DOCTOR, roles.PHARMACY]);

const sanitizeUser = (user) => ({
  id: user._id,
  fullName: user.fullName,
  email: user.email || null,
  phone: user.phone || null,
  role: user.role,
  isVerified: user.isVerified,
  authProvider: user.authProvider,
  profile: user.profile || {},
  doctorProfile: user.doctorProfile || {},
  pharmacyProfile: user.pharmacyProfile || {},
});

const genericForgotPasswordMessage =
  'If the email is registered, an OTP has been sent to that address.';

const lockUserAccount = async (user) => {
  user.lockUntil = new Date(Date.now() + accountLockMinutes * 60 * 1000);
  await user.save();
};

const resetLoginFailureCounter = async (user) => {
  if (user.failedLoginAttempts !== 0 || user.lockUntil) {
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    await user.save();
  }
};

const issueOtpChallenge = async ({ user, purpose, req, metadata = {} }) => {
  const otpResult = await issueOtp({
    userId: user._id,
    email: user.email,
    purpose,
    metadata,
  });

  if (otpResult.throttled) {
    return {
      message: `OTP recently sent. Please wait ${otpResult.waitSeconds}s before requesting again.`,
      purpose,
      otpFlowToken: signOtpFlowToken({
        userId: user._id,
        email: user.email,
        role: user.role,
        purpose,
      }),
      expiresAt: otpResult.expiresAt,
      resendAfterSeconds: otpResult.waitSeconds,
    };
  }

  await emailService.sendOtpEmail({ email: user.email, code: otpResult.otp, purpose });

  await writeAuditLog({
    userId: user._id,
    action: `AUTH_OTP_SENT_${purpose.toUpperCase()}`,
    status: 'SUCCESS',
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
    metadata: { email: user.email },
  });

  return {
    message: 'OTP sent to your email address.',
    purpose,
    otpFlowToken: signOtpFlowToken({
      userId: user._id,
      email: user.email,
      role: user.role,
      purpose,
    }),
    expiresAt: otpResult.expiresAt,
    resendAfterSeconds: 0,
  };
};

const finalizeAuth = async ({ user, req }) => {
  const accessToken = signAccessToken(user);
  const refreshToken = await createRefreshToken({
    user,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  return {
    accessToken,
    refreshToken,
    tokenExpiry: process.env.JWT_EXPIRES_IN || '15m',
    user: sanitizeUser(user),
    role: user.role,
  };
};

exports.signup = asyncHandler(async (req, res) => {
  const { fullName, email, phone, password, role = roles.PATIENT } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const normalizedRole = String(role || roles.PATIENT).toLowerCase();

  if (!PUBLIC_REGISTRATION_ROLES.has(normalizedRole)) {
    throw new ApiError(400, 'Invalid role for self registration');
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (!existing.isVerified && existing.authProvider === 'local') {
      const challenge = await issueOtpChallenge({ user: existing, purpose: 'signup', req, metadata: { source: 'signup_retry' } });
      return res.status(200).json({
        success: true,
        message: challenge.message,
        purpose: challenge.purpose,
        otpFlowToken: challenge.otpFlowToken,
        expiresAt: challenge.expiresAt,
        resendAfterSeconds: challenge.resendAfterSeconds,
      });
    }
    throw new ApiError(409, 'User with this email already exists');
  }

  const user = await User.create({
    fullName,
    email: normalizedEmail,
    phone: phone ? String(phone).trim() : undefined,
    password,
    role: normalizedRole,
    authProvider: 'local',
    isVerified: false,
  });

  await LoginProvider.create({
    userId: user._id,
    provider: 'local',
    email: user.email,
    isPrimary: true,
  });

  const challenge = await issueOtpChallenge({ user, purpose: 'signup', req });

  return res.status(201).json({
    success: true,
    message: challenge.message,
    purpose: challenge.purpose,
    otpFlowToken: challenge.otpFlowToken,
    expiresAt: challenge.expiresAt,
    resendAfterSeconds: challenge.resendAfterSeconds,
  });
});

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const normalizedEmail = String(email || '').trim().toLowerCase();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) throw new ApiError(401, 'Invalid credentials');

  if (user.isAccountLocked()) {
    throw new ApiError(423, 'Account is temporarily locked due to failed attempts');
  }

  if (!user.password) {
    throw new ApiError(401, 'This account uses Google login. Please continue with Google.');
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= maxLoginAttempts) {
      await lockUserAccount(user);
      await writeAuditLog({
        userId: user._id,
        action: 'AUTH_ACCOUNT_LOCKED_LOGIN',
        status: 'FAILED',
        ip: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      throw new ApiError(423, 'Account is temporarily locked due to failed attempts');
    }
    await user.save();
    throw new ApiError(401, 'Invalid credentials');
  }

  await resetLoginFailureCounter(user);

  if (!user.isVerified) {
    const challenge = await issueOtpChallenge({ user, purpose: 'signup', req, metadata: { source: 'login_unverified' } });
    return res.status(200).json({
      success: true,
      message: 'Your account is not verified yet. Please verify with OTP to continue.',
      purpose: challenge.purpose,
      otpFlowToken: challenge.otpFlowToken,
      expiresAt: challenge.expiresAt,
      resendAfterSeconds: challenge.resendAfterSeconds,
    });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const challenge = await issueOtpChallenge({ user, purpose: 'login', req });

  return res.json({
    success: true,
    message: challenge.message,
    purpose: challenge.purpose,
    otpFlowToken: challenge.otpFlowToken,
    expiresAt: challenge.expiresAt,
    resendAfterSeconds: challenge.resendAfterSeconds,
  });
});

exports.googleLogin = asyncHandler(async (req, res) => {
  const googleToken = req.body.googleToken || req.body.token || req.body.credential;
  const profile = await verifyGoogleIdToken(googleToken);

  let user = await User.findOne({ email: profile.email });
  if (!user) {
    user = await User.create({
      fullName: profile.fullName,
      email: profile.email,
      role: roles.PATIENT,
      authProvider: 'google',
      googleSub: profile.sub,
      isVerified: true,
    });
  } else {
    user.authProvider = 'google';
    user.googleSub = profile.sub;
    await user.save();
  }

  const existingProvider = await LoginProvider.findOne({ provider: 'google', providerUserId: profile.sub });
  if (!existingProvider) {
    await LoginProvider.create({
      userId: user._id,
      provider: 'google',
      providerUserId: profile.sub,
      email: profile.email,
      isPrimary: true,
    });
  }

  const challenge = await issueOtpChallenge({ user, purpose: 'google_login', req });

  return res.json({
    success: true,
    message: challenge.message,
    purpose: challenge.purpose,
    otpFlowToken: challenge.otpFlowToken,
    expiresAt: challenge.expiresAt,
    resendAfterSeconds: challenge.resendAfterSeconds,
  });
});

exports.verifyOtpCode = asyncHandler(async (req, res) => {
  const { otpFlowToken, otp } = req.body;
  if (!otpFlowToken || !otp) throw new ApiError(400, 'otpFlowToken and otp are required');

  const decoded = verifyToken(otpFlowToken);
  if (decoded?.tokenType !== 'otp_flow') throw new ApiError(401, 'Invalid OTP flow token');

  const user = await User.findById(decoded.sub);
  if (!user) throw new ApiError(404, 'User not found');

  const verifyResult = await verifyOtp({ email: decoded.email, purpose: decoded.purpose, otp });
  if (!verifyResult.ok) {
    if (verifyResult.code === 'OTP_MAX_ATTEMPTS') {
      await lockUserAccount(user);
    }
    await writeAuditLog({
      userId: user._id,
      action: `AUTH_OTP_VERIFY_${decoded.purpose.toUpperCase()}`,
      status: 'FAILED',
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
      metadata: { reason: verifyResult.reason },
    });
    throw new ApiError(400, verifyResult.reason);
  }

  await resetLoginFailureCounter(user);
  if (decoded.purpose === 'signup' && !user.isVerified) {
    user.isVerified = true;
  }
  user.lastLoginAt = new Date();
  await user.save();

  const payload = await finalizeAuth({ user, req });

  await writeAuditLog({
    userId: user._id,
    action: `AUTH_LOGIN_COMPLETED_${decoded.purpose.toUpperCase()}`,
    status: 'SUCCESS',
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  return res.json({ success: true, ...payload });
});

exports.resendOtp = asyncHandler(async (req, res) => {
  const { otpFlowToken } = req.body;
  if (!otpFlowToken) throw new ApiError(400, 'otpFlowToken is required');

  const decoded = verifyToken(otpFlowToken);
  if (decoded?.tokenType !== 'otp_flow') throw new ApiError(401, 'Invalid OTP flow token');

  const user = await User.findById(decoded.sub);
  if (!user) {
    if (decoded.purpose === 'forgot_password') {
      return res.json({
        success: true,
        message: genericForgotPasswordMessage,
        otpFlowToken,
        resendAfterSeconds: otpResendCooldownSeconds,
      });
    }
    throw new ApiError(404, 'User not found');
  }

  const resendCheck = await canResendOtp({ email: decoded.email, purpose: decoded.purpose });
  if (!resendCheck.allowed) {
    return res.status(429).json({
      success: false,
      message: `Please wait ${resendCheck.waitSeconds}s before resending OTP.`,
      resendAfterSeconds: resendCheck.waitSeconds,
    });
  }

  const challenge = await issueOtpChallenge({
    user,
    purpose: decoded.purpose,
    req,
    metadata: { source: 'resend' },
  });

  return res.json({
    success: true,
    message: challenge.message,
    purpose: challenge.purpose,
    otpFlowToken: challenge.otpFlowToken,
    expiresAt: challenge.expiresAt,
    resendAfterSeconds: challenge.resendAfterSeconds,
  });
});

exports.refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) throw new ApiError(400, 'refreshToken is required');

  const decoded = verifyToken(refreshToken);
  if (decoded?.tokenType !== 'refresh') throw new ApiError(401, 'Invalid refresh token');

  const user = await User.findById(decoded.sub);
  if (!user || !user.isActive) throw new ApiError(401, 'Invalid refresh token');

  const rotatedToken = await rotateRefreshToken({
    token: refreshToken,
    user,
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  return res.json({
    success: true,
    accessToken: signAccessToken(user),
    refreshToken: rotatedToken,
    tokenExpiry: process.env.JWT_EXPIRES_IN || '15m',
    user: sanitizeUser(user),
    role: user.role,
  });
});

exports.logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) {
    await revokeRefreshToken({ token: refreshToken, ip: req.ip });
  }

  return res.json({ success: true, message: 'Logged out successfully' });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  if (!email) throw new ApiError(400, 'email is required');

  const user = await User.findOne({ email });
  if (!user) {
    const fakeFlowToken = signOtpFlowToken({
      userId: new mongoose.Types.ObjectId().toString(),
      email,
      role: roles.PATIENT,
      purpose: 'forgot_password',
    });
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);
    return res.json({
      success: true,
      message: genericForgotPasswordMessage,
      otpFlowToken: fakeFlowToken,
      resendAfterSeconds: otpResendCooldownSeconds,
      expiresAt,
    });
  }

  const challenge = await issueOtpChallenge({ user, purpose: 'forgot_password', req });

  await writeAuditLog({
    userId: user._id,
    action: 'AUTH_FORGOT_PASSWORD_OTP_SENT',
    status: 'SUCCESS',
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  return res.json({
    success: true,
    message: genericForgotPasswordMessage,
    otpFlowToken: challenge.otpFlowToken,
    resendAfterSeconds: challenge.resendAfterSeconds,
    expiresAt: challenge.expiresAt,
  });
});

exports.verifyForgotPasswordOtp = asyncHandler(async (req, res) => {
  const { otpFlowToken, otp } = req.body;
  if (!otpFlowToken || !otp) throw new ApiError(400, 'otpFlowToken and otp are required');

  const decoded = verifyToken(otpFlowToken);
  if (decoded?.tokenType !== 'otp_flow' || decoded.purpose !== 'forgot_password') {
    throw new ApiError(401, 'Invalid forgot-password flow token');
  }

  const user = await User.findById(decoded.sub);
  if (!user) throw new ApiError(400, 'Invalid or expired OTP');

  const verifyResult = await verifyOtp({ email: decoded.email, purpose: 'forgot_password', otp });
  if (!verifyResult.ok) {
    if (verifyResult.code === 'OTP_MAX_ATTEMPTS') {
      await lockUserAccount(user);
    }
    throw new ApiError(400, verifyResult.reason);
  }

  const resetToken = signPasswordResetToken({ userId: user._id, email: user.email });

  await writeAuditLog({
    userId: user._id,
    action: 'AUTH_FORGOT_PASSWORD_OTP_VERIFIED',
    status: 'SUCCESS',
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  return res.json({
    success: true,
    message: 'OTP verified. You can reset your password now.',
    resetToken,
  });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword, confirmPassword } = req.body;
  if (!resetToken || !newPassword || !confirmPassword) {
    throw new ApiError(400, 'resetToken, newPassword and confirmPassword are required');
  }
  if (newPassword !== confirmPassword) {
    throw new ApiError(400, 'Passwords do not match');
  }
  if (String(newPassword).length < 6) {
    throw new ApiError(400, 'Password must be at least 6 characters');
  }

  const decoded = verifyToken(resetToken);
  if (decoded?.tokenType !== 'password_reset') throw new ApiError(401, 'Invalid reset token');

  const user = await User.findById(decoded.sub);
  if (!user) throw new ApiError(404, 'User not found');

  if (user.password) {
    const sameAsOld = await bcrypt.compare(newPassword, user.password);
    if (sameAsOld) throw new ApiError(400, 'New password must be different from old password');
  }

  user.password = newPassword;
  user.authProvider = 'local';
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.lastPasswordChangedAt = new Date();
  await user.save();

  await revokeAllUserRefreshTokens({ userId: user._id, ip: req.ip });

  await writeAuditLog({
    userId: user._id,
    action: 'AUTH_PASSWORD_RESET_COMPLETED',
    status: 'SUCCESS',
    ip: req.ip,
    userAgent: req.get('user-agent') || '',
  });

  return res.json({ success: true, message: 'Password reset successful. Please login again.' });
});

exports.getMe = asyncHandler(async (req, res) => {
  return res.json({ success: true, user: sanitizeUser(req.user) });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['fullName', 'email', 'profile'];
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) {
      if (key === 'email') req.user[key] = String(req.body[key]).trim().toLowerCase();
      else req.user[key] = req.body[key];
    }
  });

  await req.user.save();

  return res.json({
    success: true,
    message: 'Profile updated successfully',
    user: sanitizeUser(req.user),
  });
});

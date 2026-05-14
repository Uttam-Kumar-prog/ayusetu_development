const express = require('express');
const { body } = require('express-validator');
const {
  signup,
  login,
  googleLogin,
  verifyOtpCode,
  resendOtp,
  refreshToken,
  logout,
  forgotPassword,
  verifyForgotPasswordOtp,
  resetPassword,
  getMe,
  updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = express.Router();

const emailValidator = body('email').isEmail().withMessage('email must be valid');
const signupValidators = [
  body('fullName').trim().notEmpty().withMessage('fullName is required'),
  emailValidator,
  body('phone').optional().isLength({ min: 10, max: 15 }).withMessage('phone must be 10-15 digits'),
  body('password').isString().isLength({ min: 6 }).withMessage('password must be at least 6 characters'),
  body('role').optional().isIn(['patient', 'doctor', 'pharmacy']).withMessage('invalid role'),
];

router.post(
  '/signup',
  ...signupValidators,
  validate,
  signup
);

router.post(
  '/login',
  emailValidator,
  body('password').isString().notEmpty().withMessage('password is required'),
  validate,
  login
);

router.post(
  '/google-login',
  body('googleToken').optional().isString().notEmpty(),
  body('token').optional().isString().notEmpty(),
  body('credential').optional().isString().notEmpty(),
  body().custom((value) => {
    if (!value.googleToken && !value.token && !value.credential) {
      throw new Error('googleToken is required');
    }
    return true;
  }),
  validate,
  googleLogin
);

router.post(
  '/verify-otp',
  body('otpFlowToken').isString().notEmpty().withMessage('otpFlowToken is required'),
  body('otp').isString().isNumeric().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  validate,
  verifyOtpCode
);

router.post(
  '/resend-otp',
  body('otpFlowToken').isString().notEmpty().withMessage('otpFlowToken is required'),
  validate,
  resendOtp
);

router.post(
  '/refresh-token',
  body('refreshToken').isString().notEmpty().withMessage('refreshToken is required'),
  validate,
  refreshToken
);

router.post('/logout', body('refreshToken').optional().isString(), validate, logout);

router.post('/forgot-password', emailValidator, validate, forgotPassword);

router.post(
  '/verify-forgot-password-otp',
  body('otpFlowToken').isString().notEmpty().withMessage('otpFlowToken is required'),
  body('otp').isString().isNumeric().isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
  validate,
  verifyForgotPasswordOtp
);

router.post(
  '/reset-password',
  body('resetToken').isString().notEmpty().withMessage('resetToken is required'),
  body('newPassword').isString().isLength({ min: 6 }).withMessage('newPassword must be at least 6 characters'),
  body('confirmPassword').isString().isLength({ min: 6 }).withMessage('confirmPassword must be at least 6 characters'),
  validate,
  resetPassword
);

// Backward-compatible aliases
router.post('/register', ...signupValidators, validate, signup);

router.get('/me', protect, getMe);

router.patch(
  '/me',
  protect,
  body('fullName').optional().trim().notEmpty().withMessage('fullName cannot be empty'),
  body('email').optional().isEmail().withMessage('email must be valid'),
  body('profile').optional().isObject().withMessage('profile must be an object'),
  validate,
  updateProfile
);

module.exports = router;

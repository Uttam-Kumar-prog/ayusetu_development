const jwt = require('jsonwebtoken');
const { accessTokenExpiresIn, refreshTokenExpiresIn, resetTokenExpiresMinutes } = require('../config/auth');

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      email: user.email || null,
      tokenType: 'access',
    },
    process.env.JWT_SECRET,
    { expiresIn: accessTokenExpiresIn }
  );

const signRefreshToken = (user, jti) =>
  jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      tokenType: 'refresh',
      jti,
    },
    process.env.JWT_SECRET,
    { expiresIn: refreshTokenExpiresIn }
  );

const signOtpFlowToken = ({ userId, email, role, purpose }) =>
  jwt.sign(
    {
      sub: String(userId || ''),
      email,
      role,
      purpose,
      tokenType: 'otp_flow',
    },
    process.env.JWT_SECRET,
    { expiresIn: '10m' }
  );

const signPasswordResetToken = ({ userId, email }) =>
  jwt.sign(
    {
      sub: String(userId),
      email,
      tokenType: 'password_reset',
    },
    process.env.JWT_SECRET,
    { expiresIn: `${resetTokenExpiresMinutes}m` }
  );

const verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET);

module.exports = {
  signAccessToken,
  signRefreshToken,
  signOtpFlowToken,
  signPasswordResetToken,
  verifyToken,
};

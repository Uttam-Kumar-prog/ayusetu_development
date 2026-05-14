const jwt = require('jsonwebtoken');

const signToken = (user) => {
  return jwt.sign(
    {
      sub: user._id,
      role: user.role,
      phone: user.phone || null,
      email: user.email || null,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = { signToken };

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const ApiError = require('../utils/ApiError');

const protect = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-access-token');
    if (!token) {
      return next(new ApiError(401, 'Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.sub).select('-password');
    if (!user || !user.isActive) {
      return next(new ApiError(401, 'User does not exist or is inactive'));
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(new ApiError(401, 'Invalid token'));
  }
};

const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new ApiError(403, 'Insufficient permissions'));
    }

    return next();
  };
};

module.exports = {
  protect,
  authorize,
};

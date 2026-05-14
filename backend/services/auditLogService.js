const AuditLog = require('../models/AuditLog');

const writeAuditLog = async ({
  userId = null,
  action,
  status = 'SUCCESS',
  ip = '',
  userAgent = '',
  metadata = {},
}) => {
  try {
    await AuditLog.create({ userId, action, status, ip, userAgent, metadata });
  } catch {
    // do not block auth flow on logging failure
  }
};

module.exports = { writeAuditLog };

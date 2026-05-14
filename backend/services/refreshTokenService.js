const crypto = require('crypto');
const RefreshToken = require('../models/RefreshToken');
const { signRefreshToken, verifyToken } = require('../utils/jwt');
const { refreshTokenExpiresIn } = require('../config/auth');

const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

const expiresFromNow = () => {
  const now = Date.now();
  if (String(refreshTokenExpiresIn).endsWith('d')) {
    return new Date(now + Number(refreshTokenExpiresIn.replace('d', '')) * 24 * 60 * 60 * 1000);
  }
  if (String(refreshTokenExpiresIn).endsWith('h')) {
    return new Date(now + Number(refreshTokenExpiresIn.replace('h', '')) * 60 * 60 * 1000);
  }
  return new Date(now + 7 * 24 * 60 * 60 * 1000);
};

const createRefreshToken = async ({ user, ip = '', userAgent = '' }) => {
  const jti = crypto.randomUUID();
  const token = signRefreshToken(user, jti);
  const tokenHash = hashToken(token);

  await RefreshToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: expiresFromNow(),
    createdByIp: ip,
    userAgent,
  });

  return token;
};

const revokeRefreshToken = async ({ token, ip = '' }) => {
  const tokenHash = hashToken(token);
  const record = await RefreshToken.findOne({ tokenHash, revokedAt: null });
  if (!record) return null;
  record.revokedAt = new Date();
  record.revokedByIp = ip;
  await record.save();
  return record;
};

const rotateRefreshToken = async ({ token, user, ip = '', userAgent = '' }) => {
  const decoded = verifyToken(token);
  if (decoded?.tokenType !== 'refresh') throw new Error('Invalid refresh token');

  const oldHash = hashToken(token);
  const oldRecord = await RefreshToken.findOne({
    tokenHash: oldHash,
    userId: user._id,
    revokedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!oldRecord) throw new Error('Refresh token not active');

  const newToken = await createRefreshToken({ user, ip, userAgent });
  const newHash = hashToken(newToken);

  oldRecord.revokedAt = new Date();
  oldRecord.revokedByIp = ip;
  oldRecord.replacedByTokenHash = newHash;
  await oldRecord.save();

  return newToken;
};

const revokeAllUserRefreshTokens = async ({ userId, ip = '' }) => {
  await RefreshToken.updateMany(
    { userId, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedByIp: ip } }
  );
};

module.exports = {
  createRefreshToken,
  revokeRefreshToken,
  rotateRefreshToken,
  revokeAllUserRefreshTokens,
};

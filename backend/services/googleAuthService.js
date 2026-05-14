const ApiError = require('../utils/ApiError');

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo';

const verifyGoogleIdToken = async (idToken) => {
  if (!idToken) throw new ApiError(400, 'Google token is required');

  const url = `${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(idToken)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new ApiError(401, 'Invalid Google token');
  }

  const payload = await response.json();
  const audience = process.env.GOOGLE_CLIENT_ID || '';
  if (audience && payload.aud !== audience) {
    throw new ApiError(401, 'Google token audience mismatch');
  }
  if (!payload.email || payload.email_verified !== 'true') {
    throw new ApiError(401, 'Google account email is not verified');
  }

  return {
    sub: payload.sub,
    email: String(payload.email).toLowerCase(),
    fullName: payload.name || payload.given_name || 'Google User',
    picture: payload.picture || '',
  };
};

module.exports = { verifyGoogleIdToken };

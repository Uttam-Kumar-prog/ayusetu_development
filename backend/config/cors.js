const envOriginKeys = ['CORS_ORIGIN', 'WEB_URL', 'FRONTEND_URL', 'CLIENT_URL'];

const normalizeOrigin = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const parsed = new URL(raw);
    return parsed.origin.toLowerCase();
  } catch {
    return raw.replace(/\/+$/, '').toLowerCase();
  }
};

const parseAllowedOrigins = () => {
  const entries = envOriginKeys
    .flatMap((key) => String(process.env[key] || '').split(','))
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);

  return [...new Set(entries)];
};

const toRegex = () => {
  const value = String(process.env.CORS_ORIGIN_REGEX || '').trim();
  if (!value) return null;
  try {
    return new RegExp(value, 'i');
  } catch {
    return null;
  }
};

const createOriginValidator = () => {
  const allowedOrigins = parseAllowedOrigins();
  const allowedRegex = toRegex();
  const allowAll = String(process.env.CORS_ALLOW_ALL || '').toLowerCase() === 'true';

  return (origin, callback) => {
    if (!origin) return callback(null, true); // non-browser clients / health checks
    if (allowAll) return callback(null, true);

    const normalizedOrigin = normalizeOrigin(origin);
    if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
    if (allowedRegex && allowedRegex.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  };
};

const buildCorsOptions = () => ({
  origin: createOriginValidator(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
});

const buildSocketCorsOptions = () => ({
  origin: createOriginValidator(),
  methods: ['GET', 'POST'],
  credentials: true,
});

module.exports = { buildCorsOptions, buildSocketCorsOptions };

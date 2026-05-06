/**
 * Initialization middleware helpers.
 * Guards setup flow and throttles repeated initialization attempts.
 */
const ApiError = require('../utils/ApiError');
const { getInitState } = require('../services/initState');

const requireInitialized = (req, res, next) => {
  // Only allow requests if the application has completed initial setup.
  if (!getInitState()) {
    return next(new ApiError(403, 'System not initialized'));
  }
  return next();
};

const requireNotInitialized = (req, res, next) => {
  // Only allow setup routes when the system has not been initialized yet.
  if (getInitState()) {
    return next(new ApiError(403, 'System already initialized'));
  }
  return next();
};

const setupRateLimit = (() => {
  const WINDOW_MS = 10 * 60 * 1000;
  const MAX_ATTEMPTS = 10;
  const hits = new Map();

  return (req, res, next) => {
    // Simple rate limiter keyed by IP or forwarded client address.
    const key = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || (now - entry.start) > WINDOW_MS) {
      hits.set(key, { start: now, count: 1 });
      return next();
    }
    entry.count += 1;
    if (entry.count > MAX_ATTEMPTS) {
      return next(new ApiError(429, 'Too many setup attempts. Please try later.'));
    }
    return next();
  };
})();

module.exports = {
  requireInitialized,
  requireNotInitialized,
  setupRateLimit
};

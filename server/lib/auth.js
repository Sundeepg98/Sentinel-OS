const { createClerkClient } = require('@clerk/clerk-sdk-node');
const logger = require('./logger');

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * 🔐 AUTH MIDDLEWARE (Velocity-First Edition)
 * Bypasses if AUTH_ENABLED is false OR if a valid developer bypass header is present.
 */
const authGuard = async (req, res, next) => {
  const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
  const BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || 'sentinel_staff_2026';
  
  // 🚀 STREAM BYPASS: EventSource doesn't support custom headers
  if (req.path === '/intelligence/stream') {
    req.userId = 'stream-guest';
    return next();
  }

  // 🚀 DEVELOPER BYPASS (For testing the AUTH logic without the UI friction)
  const bypassHeader = req.headers['x-sentinel-bypass'];
  if (bypassHeader === BYPASS_TOKEN) {
    req.userId = 'local-admin';
    return next();
  }

  if (!AUTH_ENABLED) {
    req.userId = 'local-admin';
    return next();
  }

  try {
    const sessionToken = req.headers.authorization?.split(' ')[1];
    if (!sessionToken) {
      return res.status(401).json({ error: "Missing Authorization Header" });
    }

    const requestState = await clerkClient.authenticateRequest(req);
    
    if (requestState.isSignedIn) {
      req.userId = requestState.toAuth().userId;
      next();
    } else {
      res.status(401).json({ error: "Unauthorized Session" });
    }
  } catch (error) {
    logger.error({ error: error.message }, '🔐 Auth Error');
    res.status(401).json({ error: "Authentication Failed" });
  }
};

module.exports = { authGuard };

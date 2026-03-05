const { createClerkClient } = require('@clerk/clerk-sdk-node');

const clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

/**
 * 🔐 AUTH MIDDLEWARE (Velocity-First Edition)
 * Bypasses if AUTH_ENABLED is false OR if a valid developer bypass header is present.
 */
const authGuard = async (req, res, next) => {
  const AUTH_ENABLED = process.env.AUTH_ENABLED === 'true';
  const BYPASS_TOKEN = process.env.DEV_BYPASS_TOKEN || 'sentinel_staff_2026';
  
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

    // Verify the session via Clerk
    // Note: In a high-traffic production app, we would verify the JWT locally using the PEM key
    // to save a network round-trip. For now, we'll use the SDK for 100% correctness.
    const requestState = await clerkClient.authenticateRequest(req);
    
    if (requestState.isSignedIn) {
      req.userId = requestState.toAuth().userId;
      next();
    } else {
      res.status(401).json({ error: "Unauthorized Session" });
    }
  } catch (error) {
    console.error('🔐 Auth Error:', error.message);
    res.status(401).json({ error: "Authentication Failed" });
  }
};

module.exports = { authGuard };

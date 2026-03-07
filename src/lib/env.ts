import { z, type ZodIssue } from 'zod';

/**
 * 🛡️ FRONTEND ENVIRONMENT VALIDATION
 * Prevents silent crashes by ensuring all required VITE_ keys 
 * are present at boot time.
 */

const frontendEnvSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z.string().min(1, "Clerk Publishable Key is required for authentication."),
  VITE_AUTH_ENABLED: z.string().optional().transform(v => v === 'true'),
  VITE_API_URL: z.string().optional().default(''),
});

export const validateFrontendEnv = () => {
  try {
    return frontendEnvSchema.parse(import.meta.env);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const missing = err.issues.map((e: ZodIssue) => e.path.join('.')).join(', ');
      console.error(`💥 CRITICAL CONFIG ERROR: Missing environment variables [${missing}]`);
      // We return a safe object but log the critical error
      return { 
        VITE_CLERK_PUBLISHABLE_KEY: '', 
        VITE_AUTH_ENABLED: false,
        error: `Missing: ${missing}`
      };
    }
    return { VITE_CLERK_PUBLISHABLE_KEY: '', VITE_AUTH_ENABLED: false };
  }
};

export const APP_VERSION = '2.7.0';
export const env = validateFrontendEnv();

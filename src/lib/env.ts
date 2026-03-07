import { z, type ZodIssue } from 'zod';

/**
 * 🛡️ FRONTEND ENVIRONMENT VALIDATION
 * Prevents silent crashes by ensuring all required VITE_ keys
 * are present at boot time.
 */

const frontendEnvSchema = z.object({
  VITE_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'Clerk Publishable Key is required for authentication.'),
  VITE_AUTH_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
  VITE_API_URL: z.string().optional().default(''),
  VITE_DEV_BYPASS_TOKEN: z.string().optional().default('sentinel_staff_2026'),
});

interface FrontendEnv {
  VITE_CLERK_PUBLISHABLE_KEY: string;
  VITE_AUTH_ENABLED: boolean;
  VITE_API_URL: string;
  VITE_DEV_BYPASS_TOKEN: string;
  error?: string;
}

export const validateFrontendEnv = (): FrontendEnv => {
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
        VITE_API_URL: '',
        VITE_DEV_BYPASS_TOKEN: 'sentinel_staff_2026',
        error: `Missing: ${missing}`,
      };
    }
    return {
      VITE_CLERK_PUBLISHABLE_KEY: '',
      VITE_AUTH_ENABLED: false,
      VITE_API_URL: '',
      VITE_DEV_BYPASS_TOKEN: 'sentinel_staff_2026',
    };
  }
};

export const env = validateFrontendEnv();
export const APP_VERSION = '2.8.0';
export const API_VERSION = 'v1';
export const API_BASE = `${env.VITE_API_URL}/api/${API_VERSION}`;

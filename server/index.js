const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const hpp = require('hpp');
const { v4: uuidv4 } = require('uuid');
const { z } = require('zod');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const { db, initDB, isPostgres } = require('./lib/db');
const { globalState } = require('./lib/state');
const { spawnRAGWorker } = require('./lib/rag');

// --- 🛠️ ENGINEERING BASIC: API DOCUMENTATION ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sentinel-OS API',
      version: '2.8.0',
      description: 'Technical Intelligence & RAG Engine API',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: ['./server/index.js', './server/routes/*.js'],
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const { authGuard } = require('./lib/auth');
const logger = require('./lib/logger');

// --- 🛠️ ENGINEERING BASIC: ENV VALIDATION ---
const envSchema = z
  .object({
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required'),
    CLERK_SECRET_KEY: z.string().optional(),
    DEV_BYPASS_TOKEN: z.string().optional().default('sentinel_staff_2026'),
    PORT: z.string().default('3002'),
    NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
    AUTH_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === 'true'),
    DATABASE_URL: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.NODE_ENV !== 'development' && !data.DATABASE_URL) return false;
      return true;
    },
    {
      message: 'DATABASE_URL is required in staging/production environments',
      path: ['DATABASE_URL'],
    }
  )
  .refine(
    (data) => {
      if (data.AUTH_ENABLED && !data.CLERK_SECRET_KEY) return false;
      return true;
    },
    {
      message: 'CLERK_SECRET_KEY is required when AUTH_ENABLED is true',
      path: ['CLERK_SECRET_KEY'],
    }
  );

const env = envSchema.parse(process.env);

const app = express();
const PORT = env.PORT;
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');

app.set('trust proxy', 1);

// --- SECURITY & PERFORMANCE MIDDLEWARE ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://clerk.accounts.dev',
          'https://*.clerk.accounts.dev',
        ],
        connectSrc: [
          "'self'",
          'https://clerk.accounts.dev',
          'https://*.clerk.accounts.dev',
          'https://api.clerk.dev',
        ],
        imgSrc: ["'self'", 'data:', 'https://*.clerk.com', 'https://images.clerk.dev'],
        workerSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'", 'https://*.clerk.accounts.dev'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  })
);

app.use(hpp());

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});
app.use(globalRateLimiter);

app.use(compression());

app.use((req, res, next) => {
  req.id = req.headers['x-correlation-id'] || uuidv4();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('X-Correlation-ID', req.id);
  next();
});

const allowedOrigins = [
  'http://localhost:5173',
  'https://sentinel-os-staging.onrender.com',
  'https://sentinel-os-bcsv.onrender.com',
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new AppError('Strict CORS Policy: Origin not allowed', 403));
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const { responseEnvelope } = require('./lib/response');
app.use(responseEnvelope);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const { validateBody, validateParams, schemas } = require('./lib/validation');
const { AppError, asyncHandler } = require('./lib/errors');

// 🛰️ PUBLIC TELEMETRY ENDPOINT
app.post(
  '/api/v1/admin/error-logs',
  globalRateLimiter,
  validateBody(schemas.errorLogSchema),
  asyncHandler(async (req, res) => {
    const { message, stack, componentStack, url, metadata } = req.body;
    const userId = req.headers['x-sentinel-bypass'] ? 'local-admin' : req.userId || null;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    if (isPostgres) {
      await db.query(
        'INSERT INTO system_logs (type, category, message, payload, metadata, stack, url, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['UI', 'CRASH', message, componentStack, metadataStr, stack, url, userId]
      );
    } else {
      db.prepare(
        'INSERT INTO system_logs (type, category, message, payload, metadata, stack, url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('UI', 'CRASH', message, componentStack, metadataStr, stack, url, userId);
    }
    res.success({ logged: true });
  })
);

// --- 🏥 HEALTH CHECK ---
app.get(
  '/health',
  asyncHandler(async (req, res) => {
    const { getCircuitState } = require('./lib/intelligence');
    let dbStatus = 'connected';
    try {
      if (isPostgres) await db.query('SELECT 1');
      else db.prepare('SELECT 1').get();
    } catch {
      dbStatus = 'unreachable';
    }

    res.success({
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      db: dbStatus,
      version: '2.8.0',
      timestamp: new Date().toISOString(),
      aiEngine: {
        activeWorker: !!globalState.activeWorker,
        isSyncing: globalState.isSyncing,
        circuitState: getCircuitState(),
      },
    });
  })
);

const v1Router = express.Router();
v1Router.use(authGuard);

v1Router.use((req, res, next) => {
  req.log = logger.child({ userId: req.userId, requestId: req.id });
  next();
});

app.use((req, res, next) => {
  if (req.path.includes('/stream')) return next();
  res.setTimeout(15000, () => {
    if (!res.headersSent) res.status(408).error('Request Timeout', 408);
  });
  next();
});

// CORE ROUTES
v1Router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const companies = [
      ...new Set(Object.values(globalState.knowledgeGraph.files).map((f) => f.company)),
    ].map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
    res.success(companies);
  })
);

v1Router.get(
  '/dossier/:id',
  validateParams(schemas.pathParamsSchema),
  asyncHandler(async (req, res) => {
    const companyId = req.params.id.toLowerCase();
    const companyModules = Object.entries(globalState.knowledgeGraph.files)
      .filter(([_, data]) => data.company.toLowerCase() === companyId)
      .map(([id, data]) => ({
        id: id.split('/').pop().replace('.md', ''),
        fullId: id,
        label: data.label,
        type: 'markdown',
        data: data.content,
      }));

    if (companyModules.length === 0) throw new AppError(`Dossier for ${companyId} not found`, 404);
    res.success({ id: companyId, name: companyId.toUpperCase(), modules: companyModules });
  })
);

// MODULAR ROUTERS
v1Router.use('/admin', require('./routes/admin'));
v1Router.use('/intelligence', require('./routes/intelligence'));
v1Router.use('/intelligence/history', require('./routes/history'));
v1Router.use('/state', require('./routes/state'));

v1Router.use((req, res) => res.error('API Endpoint Not Found', 404));
app.use('/api/v1', v1Router);

app.use(express.static(FRONTEND_DIST));
app.get(/.*/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;
  const log = req.log || logger;
  log.error(
    { path: req.path, message: err.message, stack: err.stack, isOperational },
    '💥 Server Error'
  );
  if (!res.headersSent) {
    res
      .status(statusCode)
      .error(
        env.NODE_ENV !== 'production' || isOperational
          ? err.message
          : 'An unexpected error occurred.',
        statusCode
      );
  }
});

async function startServer() {
  await initDB();
  const logsDir = path.join(__dirname, 'logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch {
    /* Logs dir exists */
  }

  const server = app.listen(PORT, () => {
    logger.info(`Intelligence Engine ACTIVE on ${PORT}`);
    spawnRAGWorker();
  });

  async function gracefulShutdown(signal) {
    logger.info(`🛑 Signal ${signal} received. Shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      logger.error('💀 Graceful shutdown timed out. Forcing exit.');
      process.exit(1);
    }, 10000);
    forceExit.unref();

    if (globalState.activeWorker) {
      await globalState.activeWorker.terminate();
    }

    server.close(async () => {
      if (db && typeof db.close === 'function') await db.close();
      clearTimeout(forceExit);
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('unhandledRejection', (err) => {
    logger.error(err, '💥 Unhandled Rejection');
    gracefulShutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.error(err, '💥 Uncaught Exception');
    gracefulShutdown('uncaughtException');
  });
}

startServer();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;
const { Worker } = require('worker_threads');
const { Index } = require('flexsearch');
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

// --- 🛠️ ENGINEERING BASIC: API DOCUMENTATION ---
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sentinel-OS API',
      version: '2.7.0',
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

// 🛡️ ENGINEERING BASIC: TRUST PROXY
// Essential for correct IP-based rate limiting on managed cloud platforms.
app.set('trust proxy', 1);

// Initialize Core Systems
initDB();

// Ensure Logs Directory Exists
const ensureLogsDir = async () => {
  const logsDir = path.join(__dirname, 'logs');
  try {
    await fs.mkdir(logsDir, { recursive: true });
  } catch {
    // Already exists
  }
};
ensureLogsDir();

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
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    permissionsPolicy: {
      features: {
        accelerometer: [],
        camera: [],
        geolocation: [],
        gyroscope: [],
        magnetometer: [],
        microphone: [],
        payment: [],
        usb: [],
      },
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

app.use(
  compression({
    filter: (req, res) => {
      if (req.headers.accept === 'text/event-stream') return false;
      return compression.filter(req, res);
    },
  })
);

app.use((req, res, next) => {
  req.id = req.headers['x-correlation-id'] || uuidv4();
  req.log = logger.child({ requestId: req.id }); // 🛡️ STAFF LOGGING: Child logger injection
  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Correlation-ID', req.id);
  next();
});

// --- 🛡️ ENGINEERING BASIC: REQUEST IDEMPOTENCY ---
const LRUCache = require('lru-cache');
const idempotencyCache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 5 }); // 5 min window

app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'DELETE') {
    const key = `${req.userId}:${req.id}:${req.path}`;
    if (idempotencyCache.has(key)) {
      logger.warn({ requestId: req.id }, '🔁 Duplicate Request Detected (Idempotency Active)');
      return res.success({ _idempotent: true, message: 'Request already processed' });
    }
    idempotencyCache.set(key, true);
  }
  next();
});

// --- 🛰️ STAFF-LEVEL REQUEST LOGGING ---
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = req.log || logger;
    log.info(
      {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('content-length'),
        userAgent: req.headers['user-agent'],
      },
      '📡 HTTP Request Handled'
    );
  });
  next();
});

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : [
      'http://localhost:5173',
      'https://sentinel-os-staging.onrender.com',
      'https://sentinel-os-bcsv.onrender.com',
    ];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Strict CORS Policy: Origin not allowed'));
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
/**
 * @openapi
 * /admin/error-logs:
 *   post:
 *     tags: [Audit & Telemetry]
 *     summary: Report a frontend crash or component error
 *     security: [] # Public endpoint
 */
app.post(
  '/api/v1/admin/error-logs',
  globalRateLimiter,
  validateBody(schemas.errorLogSchema),
  asyncHandler(async (req, res) => {
    const { message, stack, componentStack, url, metadata } = req.body;
    const { db, isPostgres } = require('./lib/db');

    const userId = req.headers['x-sentinel-bypass'] ? 'local-admin' : req.userId || null;

    const payload = componentStack ? `Component: ${componentStack}` : null;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    if (isPostgres) {
      await db.query(
        'INSERT INTO system_logs (type, category, message, payload, metadata, stack, url, user_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        ['UI', 'CRASH', message, payload, metadataStr, stack, url, userId]
      );
    } else {
      db.prepare(
        'INSERT INTO system_logs (type, category, message, payload, metadata, stack, url, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run('UI', 'CRASH', message, payload, metadataStr, stack, url, userId);
    }
    res.success({ logged: true });
  })
);

// --- 🏥 HEALTH CHECK ---
app.get(
  '/health',
  asyncHandler(async (req, res) => {
    const { getCircuitState } = require('./lib/intelligence');
    const os = require('os');

    const isDeep =
      req.query.deep === 'true' || req.headers['x-sentinel-bypass'] === env.DEV_BYPASS_TOKEN;

    let dbStatus = 'connected';
    try {
      if (isPostgres) {
        await db.query('SELECT 1');
      } else {
        db.prepare('SELECT 1').get();
      }
    } catch {
      dbStatus = 'unreachable';
    }

    const payload = {
      status: dbStatus === 'connected' ? 'healthy' : 'degraded',
      db: dbStatus,
      version: '2.7.0',
      timestamp: new Date().toISOString(),
    };

    if (isDeep) {
      Object.assign(payload, {
        resources: {
          uptime: Math.round(process.uptime()),
          memory: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`,
          },
          cpuLoad: os.loadavg(),
        },
        aiEngine: {
          circuitState: getCircuitState(),
          activeWorker: !!globalState.activeWorker,
          isSyncing: globalState.isSyncing,
        },
      });
    }

    res.success(payload);
  })
);

function spawnRAGWorker() {
  if (globalState.isSyncing) return;
  globalState.isSyncing = true;

  globalState.activeWorker = new Worker(path.join(__dirname, 'lib', 'rag-worker.js'));

  globalState.activeWorker.on('message', (msg) => {
    if (msg.status === 'syncing') {
      const payload = JSON.stringify({ type: 'SYNC_START' });
      globalState.clients.forEach((c) => {
        try {
          c.res.write(`data: ${payload}\n\n`);
        } catch {
          /* Ignore */
        }
      });
    }

    if (msg.status === 'complete') {
      logger.info(
        {
          files: Object.keys(msg.knowledgeGraph?.files || {}).length,
          concepts: Object.keys(msg.knowledgeGraph?.concepts || {}).length,
        },
        `📡 Intelligence Hydrated from Worker (${msg.duration}s)`
      );
      globalState.knowledgeGraph = msg.knowledgeGraph || { files: {}, concepts: {} };

      const newIndex = new Index({ preset: 'score', tokenize: 'forward' });
      Object.entries(globalState.knowledgeGraph.files).forEach(([id, file]) => {
        newIndex.add(id, file.content);
      });
      globalState.searchIndex = newIndex;

      const completePayload = JSON.stringify({ type: 'SYNC_COMPLETE' });
      globalState.clients.forEach((c) => {
        try {
          c.res.write(`data: ${completePayload}\n\n`);
        } catch {
          /* Ignore */
        }
      });
      logger.info(`🔍 Search Index Synchronized. Notified ${globalState.clients.length} clients.`);
      globalState.isSyncing = false;
    }
  });

  globalState.activeWorker.on('error', (err) => {
    logger.error('🧵 Worker Error:', err);
    globalState.isSyncing = false;
  });

  globalState.activeWorker.on('exit', () => {
    globalState.isSyncing = false;
    globalState.activeWorker = null;
  });
}

// --- API V1 ROUTER ---
const v1Router = express.Router();
v1Router.use(authGuard);

// 📡 ENGINEERING BASIC: USER-SCOPED LOGGING
v1Router.use((req, res, next) => {
  req.log = logger.child({ userId: req.userId, requestId: req.id });
  next();
});

// 🛡️ ENGINEERING BASIC: GLOBAL TIMEOUT
app.use((req, res, next) => {
  res.setTimeout(15000, () => {
    req.log.warn({ path: req.path }, '⚠️ Request Timeout Triggered');
    if (!res.headersSent) {
      res.status(408).error('Request Timeout', 408);
    }
  });
  next();
});

// Alias health in API v1
v1Router.get('/health', (req, res) => res.redirect('/health?deep=true'));

// 🛰️ RESTORED MISSION CRITICAL ROUTES
/**
 * @openapi
 * /companies:
 *   get:
 *     tags: [Technical Intelligence]
 *     summary: Discover available company intelligence profiles
 */
v1Router.get(
  '/companies',
  asyncHandler(async (req, res) => {
    const companies = [
      ...new Set(Object.values(globalState.knowledgeGraph.files).map((f) => f.company)),
    ].map((id) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1) }));
    res.success(companies);
  })
);

/**
 * @openapi
 * /dossier/{id}:
 *   get:
 *     tags: [Technical Intelligence]
 *     summary: Retrieve a full technical dossier for a specific company
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 */
v1Router.get(
  '/dossier/:id',
  validateParams(schemas.pathParamsSchema),
  asyncHandler(async (req, res) => {
    const companyId = (req.params.id || req.params.companyId).toLowerCase();
    const companyModules = Object.entries(globalState.knowledgeGraph.files)
      .filter(([_, data]) => data.company.toLowerCase() === companyId)
      .map(([id, data]) => ({
        id: id.split('/').pop().replace('.md', ''),
        fullId: id,
        label: data.label,
        type: 'markdown',
        data: data.content,
      }));

    if (companyModules.length === 0) {
      throw new AppError(`Technical dossier for ${companyId} not found`, 404);
    }

    res.success({
      id: companyId,
      name: companyId.toUpperCase(),
      targetRole: 'Staff+ Engineer',
      brandColor: companyId === 'mailin' ? 'cyan' : 'indigo',
      modules: companyModules,
    });
  })
);

// --- MOUNT MODULAR ROUTES ---
v1Router.use('/admin', require('./routes/admin'));
v1Router.use('/intelligence', require('./routes/intelligence'));
v1Router.use('/intelligence/history', require('./routes/history'));
v1Router.use('/state', require('./routes/state'));

v1Router.use((req, res) => {
  res.error('API Endpoint Not Found', 404);
});

app.use('/api/v1', v1Router);

app.use(express.static(FRONTEND_DIST));

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
});

app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;
  const log = req.log || logger;

  log.error(
    {
      path: req.path,
      message: err.message,
      stack: env.NODE_ENV !== 'production' ? err.stack : undefined,
      isOperational,
    },
    '💥 Server Error'
  );

  if (!res.headersSent) {
    res
      .status(statusCode)
      .error(
        env.NODE_ENV !== 'production' || isOperational
          ? err.message
          : 'An unexpected error occurred.',
        statusCode,
        err.details || null
      );
  }
});

const server = app.listen(PORT, () => {
  logger.info(`Intelligence Engine ACTIVE on ${PORT}`);
  spawnRAGWorker();
});

// --- 🛡️ NUCLEAR PROCESS SAFETY ---
async function gracefulShutdown(signal) {
  logger.info(`🛑 Signal ${signal} received. Shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    logger.error('💀 Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (globalState.activeWorker) {
      logger.info('🧵 Terminating RAG Worker...');
      await globalState.activeWorker.terminate();
    }

    server.close(async () => {
      logger.info('📡 Express server closed.');
      try {
        if (db && typeof db.close === 'function') {
          await db.close();
          logger.info('🗄️ Database connection closed.');
        }
      } catch (e) {
        logger.error('❌ Shutdown Error during DB close:', e);
      }
      clearTimeout(forceExit);
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Critical Shutdown Failure:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '💥 Unhandled Rejection at Promise');
  gracefulShutdown('unhandledRejection');
});

process.on('uncaughtException', (err) => {
  logger.error(err, '💥 Uncaught Exception thrown');
  gracefulShutdown('uncaughtException');
});

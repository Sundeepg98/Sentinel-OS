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
const morgan = require('morgan');
const pino = require('pino');
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
      version: '2.6.0',
      description: 'Technical Intelligence & RAG Engine API',
    },
    servers: [{ url: '/api/v1' }],
  },
  apis: ['./server/index.js', './server/routes/*.js'], 
};
const swaggerSpec = swaggerJsdoc(swaggerOptions);

const { authGuard } = require('./lib/auth');
const { INTELLIGENCE_DIR } = require('./lib/harvester');
const logger = require('./lib/logger');

// --- 🛠️ ENGINEERING BASIC: ENV VALIDATION ---
const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  PORT: z.string().default("3002"),
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  AUTH_ENABLED: z.string().optional().transform(v => v === 'true'),
  DATABASE_URL: z.string().optional()
});

const env = envSchema.parse(process.env);

const app = express();
const PORT = env.PORT;
const FRONTEND_DIST = path.join(__dirname, '..', 'dist');

// Initialize Core Systems
initDB();

// Ensure Logs Directory Exists
const ensureLogsDir = async () => {
  const logDir = path.join(__dirname, 'logs');
  try {
    await fs.mkdir(logDir, { recursive: true });
  } catch (err) {
    logger.error('Failed to create logs directory:', err);
  }
};
ensureLogsDir();

// --- 🛡️ ENGINEERING BASIC: GLOBAL SECURITY & RATE LIMITING ---
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.accounts.dev", "https://*.clerk.accounts.dev"],
      connectSrc: ["'self'", "https://clerk.accounts.dev", "https://*.clerk.accounts.dev", "https://api.clerk.dev"],
      imgSrc: ["'self'", "data:", "https://*.clerk.com", "https://images.clerk.dev"],
      workerSrc: ["'self'", "blob:"],
      frameSrc: ["'self'", "https://*.clerk.accounts.dev"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

app.use(hpp());

const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1000, 
  message: { error: "Too many requests. Please slow down." },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalRateLimiter);

app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream') return false;
    return compression.filter(req, res);
  }
}));

app.use((req, res, next) => {
  req.id = req.headers['x-correlation-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  res.setHeader('X-Correlation-ID', req.id);
  next();
});

// --- 🛡️ ENGINEERING BASIC: REQUEST IDEMPOTENCY ---
const { LRUCache } = require('lru-cache');
const idempotencyCache = new LRUCache({ max: 1000, ttl: 1000 * 60 * 5 }); // 5 min window

app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'DELETE') {
    const key = `${req.userId}:${req.id}:${req.path}`;
    if (idempotencyCache.has(key)) {
      logger.warn({ requestId: req.id }, '🔁 Duplicate Request Detected (Idempotency Active)');
      return res.success({ _idempotent: true, message: "Request already processed" });
    }
    idempotencyCache.set(key, true);
  }
  next();
});

morgan.token('id', (req) => req.id);
app.use(morgan(':id :method :url :status :res[content-length] - :response-time ms'));

const allowedOrigins = [
  'http://localhost:5173',
  'https://sentinel-os-staging.onrender.com',
  'https://sentinel-os-bcsv.onrender.com'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Strict CORS Policy: Origin not allowed'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

const { responseEnvelope } = require('./lib/response');
app.use(responseEnvelope);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- 🏥 HEALTH CHECK ---
app.get('/health', async (req, res) => {
  const { getCircuitState } = require('./lib/intelligence');
  const os = require('os');
  try {
    const dbStatus = isPostgres ? 'cloud' : 'local';
    if (isPostgres) {
      await db.query('SELECT 1');
    } else {
      db.prepare('SELECT 1').get();
    }

    const mem = process.memoryUsage();
    res.success({ 
      status: 'healthy', 
      db: dbStatus,
      worker: {
        active: !!globalState.activeWorker,
        syncing: globalState.isSyncing
      },
      aiEngine: {
        circuitState: getCircuitState()
      },
      resources: {
        memory: {
          rss: `${Math.round(mem.rss / 1024 / 1024)}MB`,
          heapUsed: `${Math.round(mem.heapUsed / 1024 / 1024)}MB`
        },
        loadAvg: os.loadavg(),
        uptime: `${Math.round(process.uptime())}s`
      },
      version: '2.6.0'
    });
  } catch (err) {
    res.error("System Unstable", 500, { db: "DOWN", message: err.message });
  }
});

function spawnRAGWorker() {
  if (globalState.isSyncing) return;
  globalState.isSyncing = true;
  
  globalState.activeWorker = new Worker(path.join(__dirname, 'lib', 'rag-worker.js'));
  
  globalState.activeWorker.on('message', (msg) => {
    if (msg.status === 'complete') {
      logger.info(`📡 Intelligence Hydrated from Worker (${msg.duration}s)`);
      globalState.knowledgeGraph = msg.knowledgeGraph;
      
      const newIndex = new Index({ preset: 'score', tokenize: 'forward' });
      Object.entries(globalState.knowledgeGraph.files).forEach(([id, file]) => {
        newIndex.add(id, file.content);
      });
      globalState.searchIndex = newIndex;
      
      const payload = JSON.stringify({ type: 'SYNC_COMPLETE', hotReload: !!msg.isHotReload });
      globalState.clients.forEach(c => {
        try { c.res.write(`data: ${payload}\n\n`); } catch (e) {}
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

// Alias health in API v1
v1Router.get('/health', (req, res) => res.redirect('/health'));

// --- MOUNT MODULAR ROUTES ---
v1Router.use('/admin', require('./routes/admin'));
v1Router.use('/intelligence', require('./routes/intelligence'));
v1Router.use('/intelligence/history', require('./routes/history'));
v1Router.use('/state', require('./routes/state'));

v1Router.use((req, res) => {
  res.error("API Endpoint Not Found", 404);
});

app.use('/api/v1', v1Router);

app.use(express.static(FRONTEND_DIST, {
  maxAge: '1y',
  setHeaders: (res, path) => {
    if (path.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  }
}));

app.get(/(.*)/, (req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));

app.use((err, req, res, next) => {
  logger.error({ id: req.id, path: req.path, message: err.message, stack: env.NODE_ENV !== 'production' ? err.stack : undefined }, '💥 Unhandled Server Error');
  res.status(err.status || 500).error(env.NODE_ENV !== 'production' ? err.message : "An unexpected error occurred.", err.status || 500);
});

const server = app.listen(PORT, () => {
  logger.info(`Intelligence Engine ACTIVE on ${PORT}`);
  spawnRAGWorker();
});

function gracefulShutdown() {
  logger.info("🛑 Signal received. Shutting down gracefully...");
  if (globalState.activeWorker) {
    logger.info("🧵 Terminating RAG Worker...");
    globalState.activeWorker.terminate();
  }
  server.close(async () => { 
    logger.info("📡 Express server closed."); 
    try {
      if (!isPostgres) db.close(); 
      else if (db.close) await db.close();
      logger.info("🗄️ Database connection closed."); 
    } catch (e) {
      logger.error("Failed to close database:", e);
    }
    process.exit(0); 
  });
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, '💥 Unhandled Rejection at Promise');
});
process.on('uncaughtException', (err) => {
  logger.error(err, '💥 Uncaught Exception thrown');
  gracefulShutdown();
});

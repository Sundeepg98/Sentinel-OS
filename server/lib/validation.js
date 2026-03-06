const { z } = require('zod');

// --- SCHEMAS ---

const drillRequestSchema = z.object({
  fileId: z.string().min(1, "fileId is required"),
  extraContext: z.string().optional()
});

const evaluateRequestSchema = z.object({
  userAnswer: z.string().min(1, "userAnswer is required"),
  question: z.string().min(1, "question is required"),
  idealResponse: z.string().min(1, "idealResponse is required"),
  fileId: z.string().min(1, "fileId is required")
});

const incidentRequestSchema = z.object({
  moduleIds: z.array(z.string()).default([])
});

const incidentEvaluateSchema = z.object({
  userAnswer: z.string().min(1, "userAnswer is required"),
  incident: z.object({
    title: z.string(),
    description: z.string(),
    logs: z.array(z.string()),
    rootCause: z.string(),
    idealMitigation: z.string()
  })
});

const semanticSearchSchema = z.object({
  q: z.string().min(1, "Search query 'q' is required"),
  limit: z.number().min(1).max(20).default(5)
});

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200, "Query too long")
});

const insightsQuerySchema = z.object({
  fileId: z.string().min(3).max(255)
});

const pathParamsSchema = z.object({
  companyId: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional(),
  filename: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional(),
  key: z.string().regex(/^[a-zA-Z0-9._-]+$/).optional(),
});

const errorLogSchema = z.object({
  message: z.string().min(1),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  url: z.string().url().optional()
});

const userStateSchema = z.object({
  value: z.any() // User state can be any valid JSON structure
});

// --- MIDDLEWARE ---

const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.error("Invalid Request Payload", 400, error.errors);
  }
};

const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (error) {
    res.error("Invalid Query Parameters", 400, error.errors);
  }
};

const validateParams = (schema) => (req, res, next) => {
  try {
    req.params = schema.parse(req.params);
    next();
  } catch (error) {
    res.error("Invalid Path Parameters", 400, error.errors);
  }
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams,
  schemas: {
    drillRequestSchema,
    evaluateRequestSchema,
    incidentRequestSchema,
    incidentEvaluateSchema,
    semanticSearchSchema,
    searchQuerySchema,
    insightsQuerySchema,
    pathParamsSchema,
    errorLogSchema,
    userStateSchema
  }
};
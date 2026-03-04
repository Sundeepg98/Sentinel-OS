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

// --- MIDDLEWARE ---

const validateBody = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    res.status(400).json({ 
      error: "Invalid Request Payload", 
      details: error.errors 
    });
  }
};

module.exports = {
  validateBody,
  schemas: {
    drillRequestSchema,
    evaluateRequestSchema,
    incidentRequestSchema,
    incidentEvaluateSchema,
    semanticSearchSchema
  }
};
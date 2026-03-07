const express = require('express');
const { db, isPostgres } = require('../lib/db');
const { validateQuery, schemas } = require('../lib/validation');
const { AppError, asyncHandler } = require('../lib/errors');

const router = express.Router();

/**
 * @openapi
 * /intelligence/history:
 *   get:
 *     tags: [Audit & Telemetry]
 *     summary: Retrieve interaction history for the current user with pagination
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 */
router.get(
  '/',
  validateQuery(schemas.paginationSchema),
  asyncHandler(async (req, res) => {
    const limit = Math.min(req.query.limit || 50, 100);
    const offset = Math.max(req.query.offset || 0, 0);

    try {
      let rows;
      if (isPostgres) {
        const dbRes = await db.query(
          'SELECT id, type, module_id, question, user_answer, evaluation, score, timestamp FROM interaction_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2 OFFSET $3',
          [req.userId, limit, offset]
        );
        rows = dbRes.rows;
      } else {
        rows = db
          .prepare(
            'SELECT id, type, module_id, question, user_answer, evaluation, score, timestamp FROM interaction_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT ? OFFSET ?'
          )
          .all(req.userId, limit, offset);
      }
      res.success(
        rows.map((r) => ({
          ...r,
          evaluation: typeof r.evaluation === 'string' ? JSON.parse(r.evaluation) : r.evaluation,
        }))
      );
    } catch (e) {
      throw new AppError('Failed to retrieve interaction history', 500, e.message);
    }
  })
);

module.exports = router;

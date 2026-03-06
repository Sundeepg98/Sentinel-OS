const express = require('express');
const { db, isPostgres } = require('../lib/db');

const router = express.Router();

/**
 * @openapi
 * /intelligence/history:
 *   get:
 *     summary: Retrieve interaction history for the current user
 */
router.get('/', async (req, res) => {
  try {
    let rows;
    if (isPostgres) {
      const dbRes = await db.query(
        "SELECT * FROM interaction_history WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 50",
        [req.userId]
      );
      rows = dbRes.rows;
    } else {
      rows = db.prepare("SELECT * FROM interaction_history WHERE user_id = ? ORDER BY timestamp DESC LIMIT 50").all(req.userId);
    }
    res.success(rows.map(r => ({ 
      ...r, 
      evaluation: typeof r.evaluation === 'string' ? JSON.parse(r.evaluation) : r.evaluation 
    })));
  } catch (e) {
    res.error("Failed to retrieve history", 500, e.message);
  }
});

module.exports = router;

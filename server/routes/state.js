const express = require('express');
const { db, isPostgres } = require('../lib/db');

const router = express.Router();

/**
 * @openapi
 * /state/{key}:
 *   get:
 *     summary: Retrieve persistent user state
 *   post:
 *     summary: Persist user state
 */
router.get('/:key', async (req, res) => {
  let row;
  if (isPostgres) {
    const dbRes = await db.query("SELECT value FROM user_state WHERE user_id = $1 AND key = $2", [req.userId, req.params.key]);
    row = dbRes.rows[0];
  } else {
    row = db.prepare("SELECT value FROM user_state WHERE user_id = ? AND key = ?").get(req.userId, req.params.key);
  }
  const val = row ? (typeof row.value === 'string' ? JSON.parse(row.value) : row.value) : null;
  res.success({ value: val });
});

router.post('/:key', async (req, res) => {
  if (isPostgres) {
    await db.query("INSERT INTO user_state (user_id, key, value) VALUES ($1, $2, $3) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP", [req.userId, req.params.key, JSON.stringify(req.body.value)]);
  } else {
    db.prepare(`INSERT INTO user_state (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`).run(req.userId, req.params.key, JSON.stringify(req.body.value));
  }
  res.success({ success: true });
});

module.exports = router;

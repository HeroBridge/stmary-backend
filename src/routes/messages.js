import { Router } from 'express';
import { query, getClient } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { sendPush } from '../services/push.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired);

// List my conversations with last message preview
router.get('/conversations', async (req, res) => {
  const { rows } = await query(
    `SELECT c.id, c.created_at,
            (SELECT json_agg(json_build_object('id', u.id, 'name', u.display_name))
             FROM conversation_participants cp2
             JOIN users u ON u.id = cp2.user_id
             WHERE cp2.conversation_id = c.id) AS participants,
            (SELECT json_build_object('body', m.body, 'created_at', m.created_at, 'sender_id', m.sender_id)
             FROM messages m WHERE m.conversation_id = c.id
             ORDER BY m.created_at DESC LIMIT 1) AS last_message
     FROM conversations c
     JOIN conversation_participants cp ON cp.conversation_id = c.id
     WHERE cp.user_id = $1
     ORDER BY c.created_at DESC`,
    [req.user.sub]
  );
  res.json(rows);
});

// Start a conversation with a set of participant user IDs
router.post('/conversations', async (req, res) => {
  const { participant_ids } = req.body || {};
  if (!Array.isArray(participant_ids) || participant_ids.length === 0) {
    return res.status(400).json({ error: 'participant_ids required' });
  }
  const all = [...new Set([req.user.sub, ...participant_ids])];
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO conversations DEFAULT VALUES RETURNING id`
    );
    const convId = rows[0].id;
    for (const uid of all) {
      await client.query(
        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2)`,
        [convId, uid]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ id: convId, participant_ids: all });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// Get messages in a conversation (must be a participant)
router.get('/conversations/:id/messages', async (req, res) => {
  const member = await query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`,
    [req.params.id, req.user.sub]
  );
  if (member.rowCount === 0) return res.status(403).json({ error: 'Not a participant' });

  const { before, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 30, 100);
  const params = [req.params.id];
  let where = `WHERE conversation_id = $1`;
  if (before) { params.push(before); where += ` AND created_at < $${params.length}`; }
  params.push(lim);

  const { rows } = await query(
    `SELECT id, sender_id, body, created_at FROM messages
     ${where} ORDER BY created_at DESC LIMIT $${params.length}`,
    params
  );
  res.json(rows.reverse());
});

// Send a message (REST fallback; real-time path is the WebSocket server)
router.post('/conversations/:id/messages', async (req, res) => {
  const { body } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  const member = await query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`,
    [req.params.id, req.user.sub]
  );
  if (member.rowCount === 0) return res.status(403).json({ error: 'Not a participant' });

  const { rows } = await query(
    `INSERT INTO messages (conversation_id, sender_id, body) VALUES ($1,$2,$3) RETURNING *`,
    [req.params.id, req.user.sub, body]
  );

  // Notify other participants + record to the Impact Transcript
  const parts = await query(
    `SELECT user_id FROM conversation_participants WHERE conversation_id=$1 AND user_id != $2`,
    [req.params.id, req.user.sub]
  );
  const sender = await query(`SELECT display_name FROM users WHERE id=$1`, [req.user.sub]);
  sendPush(parts.rows.map(p => p.user_id),
    sender.rows[0]?.display_name || 'New message', body.slice(0, 120),
    { conversation_id: req.params.id });
  await logEvent(req.user.sub, 'message_sent', {
    objectType: 'conversation', objectId: req.params.id });

  res.status(201).json(rows[0]);
});

export default router;

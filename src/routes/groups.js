import { Router } from 'express';
import { query } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();
router.use(authRequired);

// List groups in the user's org
router.get('/', async (req, res) => {
  const { rows } = await query(
    `SELECT g.*, COUNT(gm.user_id)::int AS member_count
     FROM groups g
     LEFT JOIN group_members gm ON gm.group_id = g.id
     WHERE g.org_id = $1
     GROUP BY g.id
     ORDER BY g.created_at DESC`,
    [req.user.org_id]
  );
  res.json(rows);
});

// Create a group
router.post('/', async (req, res) => {
  const { name, description, is_private, kind, visibility } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name required' });
  const k = ['channel', 'pod'].includes(kind) ? kind : 'group';
  const vis = ['public','private','secret'].includes(visibility) ? visibility : 'public';
  const { rows } = await query(
    `INSERT INTO groups (org_id, name, description, is_private, created_by, kind, visibility)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [req.user.org_id, name, description || null, !!is_private, req.user.sub, k, vis]
  );
  // Creator auto-joins as moderator
  await query(
    `INSERT INTO group_members (group_id, user_id, role) VALUES ($1,$2,'moderator')`,
    [rows[0].id, req.user.sub]
  );
  res.status(201).json(rows[0]);
});

// Join a group
router.post('/:id/join', async (req, res) => {
  await query(
    `INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)
     ON CONFLICT DO NOTHING`,
    [req.params.id, req.user.sub]
  );
  res.json({ joined: true });
});

// Leave a group
router.delete('/:id/leave', async (req, res) => {
  await query(`DELETE FROM group_members WHERE group_id=$1 AND user_id=$2`,
    [req.params.id, req.user.sub]);
  res.json({ left: true });
});

export default router;

import { Router } from 'express';
import { query, getClient } from '../db/pool.js';
import { authRequired } from '../middleware/auth.js';
import { accessibleIds, canAccess } from '../services/entitlements.js';
import { logEvent } from '../services/journey.js';

const router = Router();
router.use(authRequired);

// Carousel: the groups the user belongs to, with thumbnails, for the top bar.
router.get('/carousel', async (req, res) => {
  const { rows } = await query(
    `SELECT g.id, g.name, g.avatar_url, g.kind
     FROM group_members gm JOIN groups g ON g.id = gm.group_id
     WHERE gm.user_id = $1 ORDER BY g.name`,
    [req.user.sub]
  );
  res.json(rows);
});

// Curated feed:
//  - no group_id  -> merged: public announcements + posts from all entitled groups
//  - ?group_id=   -> just that group's feed (carousel tap), if entitled
// Cursor pagination via ?before=<ISO>.
router.get('/', async (req, res) => {
  const { group_id, before, limit } = req.query;
  const lim = Math.min(parseInt(limit) || 20, 50);
  const params = [req.user.sub];
  let scope;

  if (group_id) {
    const ok = await canAccess(req.user.sub, 'group', group_id);
    const pub = await query(`SELECT 1 FROM groups WHERE id=$1 AND visibility='public'`, [group_id]);
    if (!ok && pub.rowCount === 0) return res.status(403).json({ error: 'no access to group' });
    params.push(group_id);
    scope = `p.group_id = $${params.length}`;
  } else {
    const groupIds = await accessibleIds(req.user.sub, req.user.org_id, 'group');
    if (groupIds.length > 0) {
      params.push(groupIds);
      scope = `(p.group_id IS NULL OR p.group_id = ANY($${params.length}))`;
    } else {
      scope = `p.group_id IS NULL`;
    }
  }

  if (before) { params.push(before); }
  const beforeClause = before ? `AND p.created_at < $${params.length}` : '';
  params.push(lim);

  const { rows } = await query(
    `SELECT p.id, p.group_id, p.body, p.attachments_json, p.created_at,
            u.id AS author_id, u.display_name AS author_name, u.avatar_url AS author_avatar,
            g.name AS group_name,
            (SELECT COUNT(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
            EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) AS liked_by_me,
            (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) AS comment_count
     FROM posts p
     LEFT JOIN users u ON u.id = p.author_id
     LEFT JOIN groups g ON g.id = p.group_id
     WHERE ${scope} ${beforeClause}
     ORDER BY p.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  res.json(rows);
});

// Create a post with optional resource attachments (deep links).
router.post('/', async (req, res) => {
  const { group_id, body, attachments } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  // Announcements (org-wide, no group) are admin/mentor-only content
  if (!group_id && !['admin', 'mentor'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Announcements are posted by community staff. Pick a group for your post.' });
  }
  if (group_id) {
    const ok = await canAccess(req.user.sub, 'group', group_id);
    const pub = await query(`SELECT 1 FROM groups WHERE id=$1 AND visibility='public'`, [group_id]);
    if (!ok && pub.rowCount === 0) return res.status(403).json({ error: 'no access to group' });
  }
  const { rows } = await query(
    `INSERT INTO posts (group_id, author_id, body, attachments_json)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [group_id || null, req.user.sub, body, JSON.stringify(attachments || [])]
  );
  await logEvent(req.user.sub, 'post_created', { objectType: 'post', objectId: rows[0].id, metadata: { group_id: group_id || null } });
  res.status(201).json(rows[0]);
});

// Reactions: like | love | celebrate | support | idea (one per user per post)
const REACTIONS = ['like', 'love', 'celebrate', 'support', 'idea'];
router.post('/:id/react', async (req, res) => {
  const type = (req.body?.type || 'like');
  if (!REACTIONS.includes(type)) return res.status(400).json({ error: 'invalid reaction' });
  await query(
    `INSERT INTO post_likes (post_id, user_id, reaction_type) VALUES ($1,$2,$3)
     ON CONFLICT (post_id, user_id) DO UPDATE SET reaction_type = EXCLUDED.reaction_type`,
    [req.params.id, req.user.sub, type]);
  await logEvent(req.user.sub, 'post_reaction', { objectType: 'post', objectId: req.params.id, metadata: { type } });
  res.json({ reacted: type });
});
router.delete('/:id/react', async (req, res) => {
  await query(`DELETE FROM post_likes WHERE post_id=$1 AND user_id=$2`, [req.params.id, req.user.sub]);
  res.json({ reacted: false });
});
// Back-compat alias
router.post('/:id/like', (req, res, next) => { req.body = { type: 'like' }; req.url = `/${req.params.id}/react`; next(); });

// Reaction breakdown for a post
router.get('/:id/reactions', async (req, res) => {
  const { rows } = await query(
    `SELECT reaction_type, COUNT(*)::int AS count FROM post_likes
     WHERE post_id=$1 GROUP BY reaction_type`, [req.params.id]);
  res.json(rows);
});

// Comments
router.get('/:id/comments', async (req, res) => {
  const { rows } = await query(
    `SELECT c.*, u.display_name AS author_name
     FROM comments c LEFT JOIN users u ON u.id = c.author_id
     WHERE c.post_id = $1 ORDER BY c.created_at ASC`,
    [req.params.id]
  );
  // Assemble one level of threading: top-level comments with nested replies
  const byId = {}; const top = [];
  for (const c of rows) { c.replies = []; byId[c.id] = c; }
  for (const c of rows) {
    if (c.parent_comment_id && byId[c.parent_comment_id]) byId[c.parent_comment_id].replies.push(c);
    else top.push(c);
  }
  res.json(top);
});
router.post('/:id/comments', async (req, res) => {
  const { body, parent_comment_id } = req.body || {};
  if (!body) return res.status(400).json({ error: 'body required' });
  const { rows } = await query(
    `INSERT INTO comments (post_id, author_id, body, parent_comment_id)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, req.user.sub, body, parent_comment_id || null]
  );
  await logEvent(req.user.sub, 'comment_created', { objectType: 'post', objectId: req.params.id,
    metadata: { is_reply: !!parent_comment_id } });
  res.status(201).json(rows[0]);
});

// Share a post into a DM conversation — keeps source traceable.
router.post('/:id/share', async (req, res) => {
  const { conversation_id } = req.body || {};
  if (!conversation_id) return res.status(400).json({ error: 'conversation_id required' });
  const member = await query(
    `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`,
    [conversation_id, req.user.sub]
  );
  if (member.rowCount === 0) return res.status(403).json({ error: 'not a participant' });

  const client = await getClient();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO post_shares (post_id, shared_by, shared_to_conversation) VALUES ($1,$2,$3)`,
      [req.params.id, req.user.sub, conversation_id]
    );
    await client.query(
      `INSERT INTO messages (conversation_id, sender_id, body, shared_post_id)
       VALUES ($1,$2,$3,$4)`,
      [conversation_id, req.user.sub, 'Shared a post', req.params.id]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  await logEvent(req.user.sub, 'post_shared', {
    objectType: 'post', objectId: req.params.id, metadata: { conversation_id },
  });
  res.json({ shared: true });
});

// Report a post or comment to the moderation queue
router.post('/:id/report', async (req, res) => {
  const { reason, target_type } = req.body || {};
  const tt = target_type === 'comment' ? 'comment' : 'post';
  if (!reason) return res.status(400).json({ error: 'reason required' });
  await query(
    `INSERT INTO reports (org_id, reporter_id, target_type, target_id, reason)
     VALUES ($1,$2,$3,$4,$5)`,
    [req.user.org_id, req.user.sub, tt, req.params.id, reason]);
  res.status(201).json({ reported: true });
});

// Remove a post: author, group moderator, or org admin
router.delete('/:id', async (req, res) => {
  const { rows } = await query(`SELECT author_id, group_id FROM posts WHERE id=$1`, [req.params.id]);
  const post = rows[0];
  if (!post) return res.status(404).json({ error: 'not found' });
  let allowed = post.author_id === req.user.sub || req.user.role === 'admin';
  if (!allowed && post.group_id) {
    const mod = await query(
      `SELECT 1 FROM group_members WHERE group_id=$1 AND user_id=$2 AND role='moderator'`,
      [post.group_id, req.user.sub]);
    allowed = mod.rowCount > 0;
  }
  if (!allowed) return res.status(403).json({ error: 'not authorized to remove this post' });
  await query(`DELETE FROM posts WHERE id=$1`, [req.params.id]);
  await logEvent(req.user.sub, 'post_removed', { objectType: 'post', objectId: req.params.id });
  res.json({ removed: true });
});

// Remove a comment: author or org admin
router.delete('/comments/:commentId', async (req, res) => {
  const { rows } = await query(`SELECT author_id FROM comments WHERE id=$1`, [req.params.commentId]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (rows[0].author_id !== req.user.sub && req.user.role !== 'admin')
    return res.status(403).json({ error: 'not authorized' });
  await query(`DELETE FROM comments WHERE id=$1`, [req.params.commentId]);
  res.json({ removed: true });
});

export default router;

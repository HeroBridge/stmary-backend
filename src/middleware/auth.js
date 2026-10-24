import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, org_id: user.org_id, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

export async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
  // Moderation: suspended accounts are read-blocked everywhere
  try {
    const { rows } = await query(`SELECT is_suspended FROM users WHERE id=$1`, [req.user.sub]);
    if (!rows[0]) return res.status(401).json({ error: 'Account not found' });
    if (rows[0].is_suspended) return res.status(403).json({ error: 'Account suspended. Contact your community administrator.' });
  } catch (e) { return res.status(500).json({ error: 'auth check failed' }); }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

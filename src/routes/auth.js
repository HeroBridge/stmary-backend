import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { signToken } from '../middleware/auth.js';

const router = Router();

// Identity model: EITHER email OR username (pseudonymous) is required.
// Pseudonymous path supports the privacy pattern: a person joins with a
// username + password + their referral code; no email, no phone. The
// code carries their curated context, not their identity.
const registerSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_.-]+$/).optional(),
  password: z.string().min(8),
  display_name: z.string().min(1),
  org_id: z.string().uuid().optional(),
}).refine(d => d.email || d.username, { message: 'email or username required' });

router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });
  const { email, username, password, display_name, org_id } = parsed.data;
  const hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await query(
      `INSERT INTO users (email, username, password_hash, display_name, org_id, role)
       VALUES ($1,$2,$3,$4,$5,'member')
       RETURNING id, email, username, display_name, org_id, role`,
      [email || null, username || null, hash, display_name, org_id || null]
    );
    const user = rows[0];
    res.status(201).json({ user, token: signToken(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email or username already taken' });
    throw err;
  }
});

// Login with either identifier
router.post('/login', async (req, res) => {
  const { identifier, email, password } = req.body || {};
  const id = identifier || email; // backward compatible
  if (!id || !password) return res.status(400).json({ error: 'identifier and password required' });
  const { rows } = await query(
    `SELECT id, email, username, display_name, org_id, role, password_hash
     FROM users WHERE email=$1 OR username=$1`,
    [id]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  delete user.password_hash;
  res.json({ user, token: signToken(user) });
});

export default router;

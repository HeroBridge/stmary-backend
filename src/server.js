import express from 'express';
import 'express-async-errors'; // async route errors -> central handler, not process crash
import http from 'http';
import helmet from 'helmet';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

import { query } from './db/pool.js';
import authRoutes from './routes/auth.js';
import groupRoutes from './routes/groups.js';
import feedRoutes from './routes/feeds.js';
import resourceRoutes from './routes/resources.js';
import eventRoutes from './routes/events.js';
import messageRoutes from './routes/messages.js';
import codeRoutes from './routes/codes.js';
import profileRoutes from './routes/profiles.js';
import governanceRoutes from './routes/governance.js';
import communityRoutes from './routes/community.js';
import mentorshipRoutes from './routes/mentorship.js';
import adminRoutes from './routes/admin.js';
import impactRoutes from './routes/impact.js';
import analyticsRoutes from './routes/analytics.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check — the ALB / ECS target group pings this.
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/feeds', feedRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/codes', codeRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/governance', governanceRoutes);
app.use('/api/community', communityRoutes);
app.use('/api/mentorship', mentorshipRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/impact', impactRoutes);
app.use('/api/analytics', analyticsRoutes);

// Central error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const server = http.createServer(app);

// ---------- Real-time messaging via WebSocket ----------
// Clients connect to /ws?token=<jwt>. Messages are broadcast to
// participants of the conversation. For multi-task Fargate scaling,
// replace the in-memory map with Redis pub/sub (ElastiCache).
const wss = new WebSocketServer({ server, path: '/ws' });
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const sockets = new Map(); // userId -> Set<ws>

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const token = url.searchParams.get('token');
  let user;
  try {
    user = jwt.verify(token, SECRET);
  } catch {
    ws.close(1008, 'Invalid token');
    return;
  }
  if (!sockets.has(user.sub)) sockets.set(user.sub, new Set());
  sockets.get(user.sub).add(ws);

  ws.on('message', async (raw) => {
    try {
      const { conversation_id, body } = JSON.parse(raw);
      if (!conversation_id || !body) return;

      // Verify membership
      const member = await query(
        `SELECT 1 FROM conversation_participants WHERE conversation_id=$1 AND user_id=$2`,
        [conversation_id, user.sub]
      );
      if (member.rowCount === 0) return;

      // Persist
      const { rows } = await query(
        `INSERT INTO messages (conversation_id, sender_id, body)
         VALUES ($1,$2,$3) RETURNING *`,
        [conversation_id, user.sub, body]
      );
      const message = rows[0];

      // Fan out to all participants currently connected
      const parts = await query(
        `SELECT user_id FROM conversation_participants WHERE conversation_id=$1`,
        [conversation_id]
      );
      const offline = [];
      for (const { user_id } of parts.rows) {
        const conns = sockets.get(user_id);
        if (conns && conns.size > 0) {
          for (const conn of conns) {
            if (conn.readyState === conn.OPEN) {
              conn.send(JSON.stringify({ type: 'message', message }));
            }
          }
        } else if (user_id !== user.sub) {
          offline.push(user_id);
        }
      }
      // Push-notify participants who aren't connected right now
      if (offline.length > 0) {
        const { sendPush } = await import('./services/push.js');
        sendPush(offline, 'New message', body.slice(0, 120), { conversation_id });
      }
    } catch (err) {
      console.error('WS message error', err);
    }
  });

  ws.on('close', () => {
    const set = sockets.get(user.sub);
    if (set) { set.delete(ws); if (set.size === 0) sockets.delete(user.sub); }
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => console.log(`Community platform listening on :${PORT}`));

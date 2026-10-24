// Notifications: in-app center (always) + Expo push (when tokens exist).
import { query } from '../db/pool.js';

export async function sendPush(userIds, title, body, data = {}) {
  try {
    // 1) In-app notification center — always recorded
    for (const uid of userIds) {
      await query(
        `INSERT INTO notifications (user_id, title, body, data) VALUES ($1,$2,$3,$4)`,
        [uid, title, body || null, data]);
    }
    // 2) Device push for anyone with a registered token
    const { rows } = await query(
      `SELECT token FROM push_tokens WHERE user_id = ANY($1)`, [userIds]);
    if (rows.length === 0) return;
    const messages = rows.map(r => ({ to: r.token, sound: 'default', title, body, data }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('notify failed', err.message); // never break the request
  }
}

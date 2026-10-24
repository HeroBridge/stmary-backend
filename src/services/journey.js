import { query } from '../db/pool.js';

// Record an action to the journey transcript.
// Fire-and-forget friendly: never let logging break the request.
// For production KPI at scale, also tee this to Kinesis Firehose -> warehouse.
export async function logEvent(userId, eventType, opts = {}) {
  const { objectType = null, objectId = null, metadata = {} } = opts;
  try {
    await query(
      `INSERT INTO journey_events (user_id, event_type, object_type, object_id, metadata)
       VALUES ($1,$2,$3,$4,$5)`,
      [userId, eventType, objectType, objectId, metadata]
    );
  } catch (err) {
    console.error('journey log failed', eventType, err.message);
  }
}

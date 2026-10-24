import { query } from '../db/pool.js';
import { grantMany } from './entitlements.js';
import { logEvent } from './journey.js';

// Mark a milestone complete for a user, then run auto-graduation:
// grant the milestone's configured objects and award its badge.
export async function completeMilestone(userId, milestoneId) {
  const { rows } = await query(`SELECT * FROM milestones WHERE id=$1`, [milestoneId]);
  const milestone = rows[0];
  if (!milestone) throw new Error('milestone not found');

  await query(
    `INSERT INTO user_milestone_progress (user_id, milestone_id, status, completed_at)
     VALUES ($1,$2,'completed', now())
     ON CONFLICT (user_id, milestone_id)
     DO UPDATE SET status='completed', completed_at=now()`,
    [userId, milestoneId]
  );

  // Auto-graduation: grant the objects tied to this milestone
  const grants = Array.isArray(milestone.grants_json) ? milestone.grants_json : [];
  if (grants.length > 0) {
    await grantMany(userId, grants, `milestone:${milestoneId}`);
  }

  // Award badge if configured
  if (milestone.award_badge) {
    await query(
      `INSERT INTO user_badges (user_id, badge_id) VALUES ($1,$2)
       ON CONFLICT DO NOTHING`,
      [userId, milestone.award_badge]
    );
    await logEvent(userId, 'badge_earned', { objectType: 'badge', objectId: milestone.award_badge });
  }

  await logEvent(userId, 'milestone_completed', {
    objectType: 'milestone', objectId: milestoneId,
    metadata: { granted: grants.length, badge: milestone.award_badge || null },
  });

  return { milestoneId, granted: grants, badge: milestone.award_badge || null };
}

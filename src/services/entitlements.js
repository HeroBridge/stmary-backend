import { query, getClient } from '../db/pool.js';

// Grant a single entitlement (idempotent).
export async function grant(client, userId, objectType, objectId, grantedBy = 'system') {
  const q = client || { query };
  await q.query(
    `INSERT INTO user_entitlements (user_id, object_type, object_id, granted_by)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (user_id, object_type, object_id) DO NOTHING`,
    [userId, objectType, objectId, grantedBy]
  );
}

// Grant many at once, inside one transaction.
export async function grantMany(userId, grants, grantedBy = 'system') {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    for (const g of grants) {
      await grant(client, userId, g.object_type, g.object_id, grantedBy);
      // If a group is granted, auto-join membership so feeds/carousel work.
      if (g.object_type === 'group') {
        await client.query(
          `INSERT INTO group_members (group_id, user_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [g.object_id, userId]
        );
      }
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Does the user have access to a specific object?
// Public objects are always accessible within the org; private/secret need an entitlement.
export async function canAccess(userId, objectType, objectId) {
  const { rows } = await query(
    `SELECT 1 FROM user_entitlements
     WHERE user_id=$1 AND object_type=$2 AND object_id=$3`,
    [userId, objectType, objectId]
  );
  return rows.length > 0;
}

// Return the set of object IDs of a given type the user can access,
// combining public objects (org-wide) with explicit entitlements.
export async function accessibleIds(userId, orgId, objectType) {
  if (objectType === 'group') {
    const { rows } = await query(
      `SELECT id FROM groups
       WHERE org_id=$2 AND (visibility='public'
         OR id IN (SELECT object_id FROM user_entitlements WHERE user_id=$1 AND object_type='group'))`,
      [userId, orgId]
    );
    return rows.map(r => r.id);
  }
  if (objectType === 'resource') {
    const { rows } = await query(
      `SELECT id FROM resources
       WHERE org_id=$2 AND (visibility='public'
         OR id IN (SELECT object_id FROM user_entitlements WHERE user_id=$1 AND object_type='resource'))`,
      [userId, orgId]
    );
    return rows.map(r => r.id);
  }
  const { rows } = await query(
    `SELECT object_id FROM user_entitlements WHERE user_id=$1 AND object_type=$2`,
    [userId, objectType]
  );
  return rows.map(r => r.object_id);
}

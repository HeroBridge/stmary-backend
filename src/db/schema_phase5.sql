-- ============================================================
-- Phase 5: Referral Code Engine v2
-- Mentor matching, arrival onboarding, batch single-use codes,
-- pseudonymous identity. Run AFTER phases 1-4.
-- ============================================================

-- Onboarding payload carried by a code:
-- { "role": "member|mentor",
--   "mentor_id": "<uuid>"            -- direct mentor assignment
--   "mentor_pool": ["<uuid>", ...],  -- OR pick least-loaded from pool
--   "welcome_message": "text",       -- DM sent from the matched mentor
--   "starter_goals": ["title", ...] }
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS onboarding_json JSONB NOT NULL DEFAULT '{}';

-- Batch support: many single-use codes stamped from one template
ALTER TABLE referral_codes ADD COLUMN IF NOT EXISTS batch_id UUID;
CREATE INDEX IF NOT EXISTS idx_codes_batch ON referral_codes(batch_id);

-- Pseudonymous identity: email becomes optional; username is an
-- alternative unique identifier. A person can join with ONLY a
-- username + password + their code.
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

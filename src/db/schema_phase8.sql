-- ============================================================
-- Phase 8: Mentorship & Support + Community Management
-- ============================================================

-- Mentor profile fields (visible on mentor/mentee profiles)
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_specialties TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_capacity INTEGER;      -- max concurrent mentees
ALTER TABLE users ADD COLUMN IF NOT EXISTS mentor_availability TEXT;     -- freeform: "Tue/Thu evenings"

-- Peer champions: trusted members who can see and claim peer support requests
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_peer_champion BOOLEAN NOT NULL DEFAULT false;

-- Mentorship pods: small groups with a mentor lead (reuses ALL group machinery:
-- entitlements, codes, feed, visibility)
ALTER TABLE groups DROP CONSTRAINT IF EXISTS groups_kind_check;
ALTER TABLE groups ADD CONSTRAINT groups_kind_check CHECK (kind IN ('group','channel','pod'));

-- Support requests: "I need help" -> routed to mentor or peer champions
CREATE TABLE IF NOT EXISTS support_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL DEFAULT 'general',   -- general | academic | wellbeing | logistics | other
  body        TEXT NOT NULL,
  audience    TEXT NOT NULL DEFAULT 'mentor' CHECK (audience IN ('mentor','peer','admin')),
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','claimed','resolved','withdrawn')),
  claimed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_open ON support_requests(org_id, status, created_at DESC);

-- Mentor sessions & check-ins (one table, typed)
CREATE TABLE IF NOT EXISTS mentor_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id     UUID REFERENCES mentorship_matches(id) ON DELETE CASCADE,
  session_type TEXT NOT NULL DEFAULT 'session' CHECK (session_type IN ('session','check_in')),
  occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  duration_min INTEGER,
  notes        TEXT,                              -- mentor's working notes
  mentee_visible_summary TEXT,                    -- what the mentee sees
  mood         TEXT,                              -- check-ins: how the mentee said they're doing
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_match ON mentor_sessions(match_id, occurred_at DESC);

-- Recommended next steps: mentor- or system-suggested, tracked to done
CREATE TABLE IF NOT EXISTS recommended_steps (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  resource_id UUID REFERENCES resources(id) ON DELETE SET NULL,
  created_by  TEXT NOT NULL,                      -- 'mentor:<id>' | 'agent:tilly' | 'admin:<id>'
  status      TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested','accepted','done','dismissed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_steps_user ON recommended_steps(user_id, status);

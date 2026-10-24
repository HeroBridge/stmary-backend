-- ============================================================
-- Hero One Eleven Community OS — Phase 2 schema
-- Adds: entitlements, referral codes, milestones/learning tracks,
-- rich resources + deep links, badges, profiles, reactions, shares,
-- and the journey transcript (event log).
-- Run AFTER schema.sql.
-- ============================================================

-- ---------- Visibility on groups & resources ----------
-- public  = everyone in org sees it
-- private = visible only to members, but discoverable/listable
-- secret  = invisible unless explicitly entitled
ALTER TABLE groups    ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public','private','secret'));
ALTER TABLE groups    ADD COLUMN IF NOT EXISTS avatar_url TEXT; -- carousel thumbnail
ALTER TABLE resources ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public'
  CHECK (visibility IN ('public','private','secret'));

-- A resource may belong to a group (gates it behind group entitlement)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES groups(id) ON DELETE CASCADE;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS resource_type TEXT NOT NULL DEFAULT 'link'
  CHECK (resource_type IN ('video','document','form','course','event_link','mentorship_group','external_link'));
ALTER TABLE resources ADD COLUMN IF NOT EXISTS content_url TEXT;     -- cloud library object key or URL
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN NOT NULL DEFAULT false; -- opens in in-app player via signed access
ALTER TABLE resources ADD COLUMN IF NOT EXISTS show_on_map BOOLEAN NOT NULL DEFAULT false;

-- ---------- Entitlements (the heart of the system) ----------
-- A single row = "this user may access this object".
-- object_type lets one table gate every kind of grantable thing.
CREATE TABLE IF NOT EXISTS user_entitlements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('group','resource','track','event')),
  object_id   UUID NOT NULL,
  granted_by  TEXT NOT NULL DEFAULT 'system', -- 'code:<id>' | 'milestone:<id>' | 'admin:<userid>' | 'system'
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, object_type, object_id)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_user ON user_entitlements(user_id, object_type);

-- ---------- Referral codes ----------
CREATE TABLE IF NOT EXISTS referral_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code        TEXT UNIQUE NOT NULL,
  label       TEXT,                      -- internal description, e.g. "Spring cohort - youth track"
  max_uses    INTEGER,                   -- null = unlimited
  use_count   INTEGER NOT NULL DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- What a code grants (the dropdown picks that build this list)
CREATE TABLE IF NOT EXISTS referral_code_grants (
  code_id     UUID REFERENCES referral_codes(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL CHECK (object_type IN ('group','resource','track','event')),
  object_id   UUID NOT NULL,
  PRIMARY KEY (code_id, object_type, object_id)
);

-- ---------- Learning tracks, milestones & auto-graduation ----------
CREATE TABLE IF NOT EXISTS learning_tracks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS milestones (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id    UUID REFERENCES learning_tracks(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  position    INTEGER NOT NULL DEFAULT 0,
  -- When completed, automatically grant these objects (auto-graduation)
  grants_json JSONB NOT NULL DEFAULT '[]', -- e.g. [{"object_type":"group","object_id":"..."}]
  award_badge UUID                          -- optional badge to award (FK added below)
);

CREATE TABLE IF NOT EXISTS user_milestone_progress (
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES milestones(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, milestone_id)
);

-- ---------- Badges ----------
CREATE TABLE IF NOT EXISTS badges (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  icon_url    TEXT
);
DO $$ BEGIN
  ALTER TABLE milestones ADD CONSTRAINT fk_milestone_badge
    FOREIGN KEY (award_badge) REFERENCES badges(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS user_badges (
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  badge_id  UUID REFERENCES badges(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge_id)
);

-- ---------- Profiles ----------
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS user_goals (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  title     TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','achieved','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  achieved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS saved_resources (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  saved_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

-- ---------- Post reactions, attachments & shares ----------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS attachments_json JSONB NOT NULL DEFAULT '[]';
-- attachments_json = [{"resource_id":"...","kind":"video"}] -> deep links into the library

CREATE TABLE IF NOT EXISTS post_likes (
  post_id   UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  liked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

-- Shares record the source so resources shared into DMs stay traceable
CREATE TABLE IF NOT EXISTS post_shares (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID REFERENCES posts(id) ON DELETE CASCADE,
  shared_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  shared_to_conversation UUID REFERENCES conversations(id) ON DELETE SET NULL,
  shared_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Let a message carry a shared post/resource reference
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shared_post_id UUID REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS shared_resource_id UUID REFERENCES resources(id) ON DELETE SET NULL;

-- ---------- Journey transcript (the event log) ----------
-- Every meaningful action lands here. This is your KPI + mentorship spine.
CREATE TABLE IF NOT EXISTS journey_events (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,   -- 'post_created','resource_viewed','event_rsvp','message_sent','badge_earned','milestone_completed','code_redeemed','post_shared','login', ...
  object_type TEXT,
  object_id   UUID,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journey_user_time ON journey_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journey_type ON journey_events(event_type, created_at DESC);

-- ============================================================
-- Phase 6: Community Experience completion
-- Replies, reactions, channels, directory, in-app notifications,
-- moderation, guidelines.
-- ============================================================

-- Threaded replies
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;

-- Reactions: one per user per post, but typed (like/love/celebrate/support/idea)
ALTER TABLE post_likes ADD COLUMN IF NOT EXISTS reaction_type TEXT NOT NULL DEFAULT 'like'
  CHECK (reaction_type IN ('like','love','celebrate','support','idea'));

-- Topic channels: lightweight open spaces; reuse all group machinery
ALTER TABLE groups ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'group'
  CHECK (kind IN ('group','channel'));

-- Directory & moderation flags on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_in_directory BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_guidelines_at TIMESTAMPTZ;

-- Community guidelines live on the org
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS guidelines_md TEXT;

-- Content reports (moderation queue)
CREATE TABLE IF NOT EXISTS reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  reporter_id  UUID REFERENCES users(id) ON DELETE SET NULL,
  target_type  TEXT NOT NULL CHECK (target_type IN ('post','comment','user','message')),
  target_id    UUID NOT NULL,
  reason       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  resolved_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reports_open ON reports(org_id, status, created_at DESC);

-- In-app notification center (push mirrors into here)
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);

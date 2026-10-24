-- ============================================================
-- Phase 4: community layer refinement
-- Push notification tokens + account deletion support.
-- ============================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL,            -- Expo push token
  platform   TEXT,                     -- 'ios' | 'android'
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, token)
);

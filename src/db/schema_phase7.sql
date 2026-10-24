-- ============================================================
-- Phase 7: Resource & Content Library
-- Pages, tags, featured, search, sequences, completion, feedback.
-- ============================================================

-- Resource pages: full content body, not just a link
ALTER TABLE resources ADD COLUMN IF NOT EXISTS body_md TEXT;          -- rich page content
ALTER TABLE resources ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS duration_minutes INTEGER; -- media/course length

-- Audio joins the media types
ALTER TABLE resources DROP CONSTRAINT IF EXISTS resources_resource_type_check;
ALTER TABLE resources ADD CONSTRAINT resources_resource_type_check
  CHECK (resource_type IN ('video','audio','document','form','course','event_link','mentorship_group','external_link','link','page'));

-- Multi-tag categories (keeps legacy single `category` column working)
ALTER TABLE resources ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_resources_tags ON resources USING GIN(tags);

-- Featured resources with ordering
ALTER TABLE resources ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS featured_rank INTEGER;

-- Full-text search over title + description + body
CREATE INDEX IF NOT EXISTS idx_resources_fts ON resources
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'') || ' ' || coalesce(body_md,'')));

-- Course sequences: a milestone can point at a resource.
-- Completing the resource completes the milestone -> auto-graduation fires.
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS resource_id UUID REFERENCES resources(id) ON DELETE SET NULL;

-- Completion tracking
CREATE TABLE IF NOT EXISTS resource_progress (
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  resource_id  UUID REFERENCES resources(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'started' CHECK (status IN ('started','completed')),
  progress_pct INTEGER NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (user_id, resource_id)
);

-- Usefulness feedback
CREATE TABLE IF NOT EXISTS resource_feedback (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  useful      BOOLEAN NOT NULL,
  rating      INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_id)
);

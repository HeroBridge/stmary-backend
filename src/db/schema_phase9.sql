-- ============================================================
-- Phase 9: Impact, Communications & Analytics
-- Claims ledger, gap engine, polling engine, ontology, stories,
-- campaigns, stakeholder preferences, engagement tracking.
-- ============================================================

-- ---------- Ontology: the shared vocabulary of constructs ----------
-- Human-outcome constructs (trust, belonging, capability, resilience...)
-- that tag events, stories, poll questions, and resources, enabling
-- slicing by MEANING rather than by raw event type.
CREATE TABLE IF NOT EXISTS ontology_terms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE, -- null = platform default
  name        TEXT NOT NULL,
  parent_id   UUID REFERENCES ontology_terms(id) ON DELETE SET NULL,
  description TEXT,
  UNIQUE (org_id, name)
);
CREATE TABLE IF NOT EXISTS ontology_tags (
  term_id     UUID REFERENCES ontology_terms(id) ON DELETE CASCADE,
  object_type TEXT NOT NULL,   -- 'story','resource','poll_question','journey_event','group','communication'
  object_id   TEXT NOT NULL,   -- TEXT to accommodate bigint journey ids
  tagged_by   TEXT NOT NULL DEFAULT 'admin',
  PRIMARY KEY (term_id, object_type, object_id)
);
CREATE INDEX IF NOT EXISTS idx_ontology_tags_obj ON ontology_tags(object_type, object_id);

-- ---------- Stakeholders & communication preferences ----------
-- Stakeholders may or may not be app users (donors, board, funders, parents).
CREATE TABLE IF NOT EXISTS stakeholders (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES users(id) ON DELETE SET NULL,  -- linked app account, if any
  name       TEXT NOT NULL,
  email      TEXT,
  kind       TEXT NOT NULL DEFAULT 'donor'
             CHECK (kind IN ('donor','funder','board','partner','parent','volunteer','staff','public')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Polled preferences: how THIS stakeholder wants to be communicated with.
CREATE TABLE IF NOT EXISTS comm_preferences (
  stakeholder_id UUID PRIMARY KEY REFERENCES stakeholders(id) ON DELETE CASCADE,
  channels       TEXT[] NOT NULL DEFAULT '{email}',   -- email | app | mail | none
  frequency      TEXT NOT NULL DEFAULT 'quarterly'
                 CHECK (frequency IN ('weekly','monthly','quarterly','annually','major_only')),
  depth          TEXT NOT NULL DEFAULT 'balanced'
                 CHECK (depth IN ('story_first','balanced','data_first')),
  topic_terms    UUID[] NOT NULL DEFAULT '{}',        -- ontology terms they care about
  polled_at      TIMESTAMPTZ NOT NULL DEFAULT now()   -- staleness drives re-polling gaps
);

-- ---------- Polling engine (one primitive, three jobs) ----------
-- Serves: comm-preference polling, readiness pulses, outcome measurement.
CREATE TABLE IF NOT EXISTS polls (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  purpose    TEXT NOT NULL DEFAULT 'pulse'
             CHECK (purpose IN ('pulse','comm_preference','outcome','readiness')),
  audience   TEXT NOT NULL DEFAULT 'members'
             CHECK (audience IN ('members','mentors','stakeholders','group')),
  group_id   UUID REFERENCES groups(id) ON DELETE CASCADE,
  is_open    BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS poll_questions (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id   UUID REFERENCES polls(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL DEFAULT 0,
  prompt    TEXT NOT NULL,
  qtype     TEXT NOT NULL DEFAULT 'scale' CHECK (qtype IN ('scale','choice','text')),
  choices   TEXT[],                                     -- for 'choice'
  construct UUID REFERENCES ontology_terms(id) ON DELETE SET NULL -- what this measures
);
CREATE TABLE IF NOT EXISTS poll_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id    UUID REFERENCES poll_questions(id) ON DELETE CASCADE,
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  scale_value    INTEGER CHECK (scale_value BETWEEN 1 AND 5),
  choice_value   TEXT,
  text_value     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id, user_id),
  CHECK (user_id IS NOT NULL OR stakeholder_id IS NOT NULL)
);

-- ---------- Story collection ----------
-- Stories are evidence. External use requires the SUBJECT's explicit
-- consent, recorded here — a story without consent can never be cited
-- in an outward communication (enforced by the claims verifier).
CREATE TABLE IF NOT EXISTS stories (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  author_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id  UUID REFERENCES users(id) ON DELETE SET NULL, -- who the story is about
  title            TEXT NOT NULL,
  body_md          TEXT NOT NULL,
  media_url        TEXT,
  story_kind       TEXT NOT NULL DEFAULT 'success'
                   CHECK (story_kind IN ('success','recognition','progress','testimony')),
  consent_external BOOLEAN NOT NULL DEFAULT false,
  consent_by       UUID REFERENCES users(id) ON DELETE SET NULL, -- subject or guardian
  consent_at       TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'submitted'
                   CHECK (status IN ('submitted','approved','archived')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Campaigns & communications ----------
CREATE TABLE IF NOT EXISTS campaigns (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  goal       TEXT,
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Extend stakeholder_reports into the general communications object
ALTER TABLE stakeholder_reports ADD COLUMN IF NOT EXISTS comm_type TEXT NOT NULL DEFAULT 'impact_update';
ALTER TABLE stakeholder_reports ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
ALTER TABLE stakeholder_reports ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'email';

-- ---------- Claims ledger (verification is the data model) ----------
CREATE TABLE IF NOT EXISTS claims (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id     UUID REFERENCES stakeholder_reports(id) ON DELETE CASCADE,
  claim_text    TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('metric','story','poll')),
  evidence_ref  JSONB NOT NULL,  -- metric: {kind, params, value, computed_at}
                                 -- story: {story_id} | poll: {question_id, avg, n}
  verified      BOOLEAN NOT NULL DEFAULT false,
  verify_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_claims_report ON claims(report_id);

-- ---------- Gap engine: recorded ignorance ----------
CREATE TABLE IF NOT EXISTS data_gaps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID REFERENCES organizations(id) ON DELETE CASCADE,
  gap_type         TEXT NOT NULL,  -- 'small_sample','no_consented_story','stale_preferences','missing_construct','no_recent_data'
  description      TEXT NOT NULL,
  needed_for       JSONB NOT NULL DEFAULT '{}',   -- {report_id | campaign_id | construct}
  suggested_action TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','collecting','resolved','dismissed')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Communication engagement (resonance raw material) ----------
CREATE TABLE IF NOT EXISTS communication_engagement (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id      UUID REFERENCES stakeholder_reports(id) ON DELETE CASCADE,
  stakeholder_id UUID REFERENCES stakeholders(id) ON DELETE CASCADE,
  action         TEXT NOT NULL CHECK (action IN ('sent','opened','clicked','replied','shared','gave_after')),
  occurred_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_comm_eng ON communication_engagement(stakeholder_id, occurred_at DESC);

-- Seed the default ontology (platform-level, org_id NULL).
-- NULL org rows aren't caught by the UNIQUE constraint, so guard explicitly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ontology_default_name
  ON ontology_terms(name) WHERE org_id IS NULL;
INSERT INTO ontology_terms (org_id, name, description)
SELECT NULL, v.name, v.descr FROM (VALUES
  ('trust', 'Confidence in people, mentors, and the organization'),
  ('belonging', 'Feeling included and valued in the community'),
  ('capability', 'Skill growth and confidence in ability'),
  ('clarity', 'Understanding of goals, expectations, and next steps'),
  ('resilience', 'Persistence through setbacks'),
  ('engagement', 'Active, sustained participation'),
  ('readiness', 'Preparedness for change, incl. AI adoption'),
  ('agency', 'Sense of ownership over one''s path')
) AS v(name, descr)
ON CONFLICT (name) WHERE org_id IS NULL DO NOTHING;

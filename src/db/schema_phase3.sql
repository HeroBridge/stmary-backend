-- ============================================================
-- Hero One Eleven Community OS — Phase 3 schema
-- Agent intelligence layer + governance + matching.
-- Run AFTER schema.sql and schema_phase2.sql.
-- ============================================================

-- ---------- Mentorship matching ----------
CREATE TABLE IF NOT EXISTS mentorship_matches (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  mentor_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mentee_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       TEXT NOT NULL DEFAULT 'proposed'
               CHECK (status IN ('proposed','active','paused','completed','declined')),
  match_reason JSONB NOT NULL DEFAULT '{}',   -- why the system/admin proposed this pairing
  proposed_by  TEXT NOT NULL DEFAULT 'admin', -- 'admin:<id>' | 'agent:cora'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (mentor_id, mentee_id)
);

-- ---------- Agent layer ----------
-- Every agent execution is recorded: what ran, on what input, what it produced.
-- Agents are pipeline jobs, not free actors: they read the journey transcript
-- and profiles, and they WRITE ONLY insights/proposals/reports. They never
-- mutate the community directly.
CREATE TABLE IF NOT EXISTS agent_runs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent       TEXT NOT NULL CHECK (agent IN ('hero','tilly','cora','eddi','rita','meerkat')),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  subject_user UUID REFERENCES users(id) ON DELETE CASCADE, -- who this run is about (nullable for org-level)
  input_summary  JSONB NOT NULL DEFAULT '{}',
  output_summary JSONB NOT NULL DEFAULT '{}',
  model_id    TEXT,                -- e.g. Bedrock model used
  status      TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('running','completed','failed')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_subject ON agent_runs(subject_user, agent, created_at DESC);

-- Structured findings the agents produce. These power tutor/mentor briefings,
-- learner profiles, and program-level pattern reports.
CREATE TABLE IF NOT EXISTS agent_insights (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID REFERENCES agent_runs(id) ON DELETE CASCADE,
  agent        TEXT NOT NULL,
  subject_user UUID REFERENCES users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,      -- 'learner_profile','pattern','evidence_eval','briefing','task','report'
  content      JSONB NOT NULL,     -- the structured insight
  confidence   NUMERIC(3,2),       -- 0.00-1.00, agent-reported
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_insights_subject ON agent_insights(subject_user, insight_type, created_at DESC);

-- RITA's operational task queue (reminders, follow-ups, evaluations)
CREATE TABLE IF NOT EXISTS agent_tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID REFERENCES organizations(id) ON DELETE CASCADE,
  task_type   TEXT NOT NULL,       -- 'reminder','follow_up','schedule_evaluation','flag_attendance'
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL, -- human who should act
  subject_user UUID REFERENCES users(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done','dismissed')),
  due_at      TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- MEERKAT's stakeholder reports (drafts require human review before sending)
CREATE TABLE IF NOT EXISTS stakeholder_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  audience     TEXT NOT NULL,      -- 'donor','parent','school','board'
  title        TEXT NOT NULL,
  body_md      TEXT NOT NULL,      -- generated narrative
  data_basis   JSONB NOT NULL DEFAULT '{}', -- the metrics behind the narrative (traceability)
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','sent')),
  reviewed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Governance: change proposals with human approval ----------
-- Agents (or admins) propose changes to the community framework. NOTHING is
-- applied without an approved row here, and only whitelisted change types
-- can be auto-applied. This is the "autonomous with guardrails" mechanism.
CREATE TABLE IF NOT EXISTS change_proposals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  proposed_by  TEXT NOT NULL,      -- 'agent:cora' | 'admin:<id>'
  change_type  TEXT NOT NULL CHECK (change_type IN (
                 'adjust_track_sequence',   -- reorder milestones in a track
                 'add_resource_to_code',    -- add a resource to a referral code bundle
                 'add_milestone_grant',     -- add an auto-graduation grant
                 'update_group_visibility', -- public/private/secret change
                 'new_data_collection'      -- ALWAYS requires approval + consent review
               )),
  rationale    TEXT NOT NULL,      -- human-readable "why" (evidence-linked)
  evidence     JSONB NOT NULL DEFAULT '{}', -- insight IDs / metrics backing it
  change_spec  JSONB NOT NULL,     -- machine-applyable description of the change
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected','applied','failed')),
  decided_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at   TIMESTAMPTZ,
  applied_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------- Privacy: consent registry & data collection policy ----------
-- Every category of data the platform collects is declared here. Adding a
-- category is itself a change_proposal of type 'new_data_collection'.
CREATE TABLE IF NOT EXISTS data_collection_policies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,     -- 'attendance','session_notes','goal_progress','video_intake','engagement_events'
  description   TEXT NOT NULL,     -- plain-language: what is collected and why
  purpose       TEXT NOT NULL,     -- 'service','mentorship','analytics','reporting'
  minor_data    BOOLEAN NOT NULL DEFAULT false, -- collected about minors?
  requires_guardian_consent BOOLEAN NOT NULL DEFAULT false,
  retention_days INTEGER,          -- null = indefinite (discouraged)
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, category)
);

-- Per-user (or guardian-on-behalf-of-minor) consent for each category.
CREATE TABLE IF NOT EXISTS consents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  policy_id     UUID NOT NULL REFERENCES data_collection_policies(id) ON DELETE CASCADE,
  granted       BOOLEAN NOT NULL,
  granted_by    UUID REFERENCES users(id) ON DELETE SET NULL, -- guardian if consenting for a minor
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,
  UNIQUE (user_id, policy_id)
);

-- Guardian linkage for minors
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_minor BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS guardianships (
  guardian_id UUID REFERENCES users(id) ON DELETE CASCADE,
  minor_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (guardian_id, minor_id)
);

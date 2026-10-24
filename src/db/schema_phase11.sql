-- ============================================================
-- Phase 11: Formation Doctrine Layer
-- A moral code as DATA: principles that constrain agents,
-- brief mentors, and veto automation of human relationship.
-- ============================================================

CREATE TABLE IF NOT EXISTS formation_principles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- null = platform default
  name       TEXT NOT NULL,
  tradition  TEXT NOT NULL,          -- 'csd' | 'confessions' | 'city_of_god' | 'org'
  summary    TEXT NOT NULL,          -- the principle, in plain words
  heuristic  TEXT NOT NULL,          -- how it applies BEHAVIORALLY in this community
  mentor_cue TEXT NOT NULL,          -- posture suggestion for the human guide (never a script)
  agent_directive TEXT NOT NULL,     -- how it constrains agent language/behavior
  stage_affinity TEXT[] NOT NULL DEFAULT '{any}',
    -- canonical journey phases: arrival | early | middle | late | complete | any
  construct  TEXT,                   -- ontology construct it most serves (belonging, discernment...)
  is_active  BOOLEAN NOT NULL DEFAULT true
);

-- When a mentor acts on a suggested principle, record it — the raw
-- material for learning WHEN each teaching serves best.
CREATE TABLE IF NOT EXISTS principle_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  principle_id UUID REFERENCES formation_principles(id) ON DELETE CASCADE,
  mentor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  mentee_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  stage        TEXT NOT NULL,
  outcome_note TEXT,                 -- mentor's own words, optional
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_principle_apps ON principle_applications(principle_id, stage);

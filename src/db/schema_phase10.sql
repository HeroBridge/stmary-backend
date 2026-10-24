-- ============================================================
-- Phase 10: Org branding / theming
-- Branding is DATA. The mobile app themes itself from this at
-- login; the Design Studio (admin) edits it live.
-- ============================================================
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS branding_version INTEGER NOT NULL DEFAULT 1;

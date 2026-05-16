-- ============================================================================
-- Migration 066: Add first_template_visit_at to profiles
-- Tracks when a user first visits the /template page, used for onboarding
-- analytics and placeholder item flow.
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS first_template_visit_at TIMESTAMPTZ DEFAULT NULL;

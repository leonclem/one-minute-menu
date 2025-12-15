-- ============================================================================
-- Migration 024: Admin Prompt Presets (Option A - store prompts only, no images)
-- ============================================================================
-- Adds an admin-only table for saving "winning" prompt presets from the admin
-- Gemini image generator harness.
--
-- Notes:
-- - Admin access is handled via RLS policy checking the caller's own profile role.
-- - We do NOT store any generated images or reference images in this migration.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS admin_prompt_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,

  -- Harness metadata
  mode TEXT NOT NULL CHECK (mode IN ('style_match', 'composite')),
  scenario_id TEXT,
  helper_values JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- The actual prompt text used in the harness
  prompt TEXT NOT NULL,

  -- Audit
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_prompt_presets_created_at ON admin_prompt_presets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_prompt_presets_mode ON admin_prompt_presets(mode);
CREATE INDEX IF NOT EXISTS idx_admin_prompt_presets_scenario_id ON admin_prompt_presets(scenario_id) WHERE scenario_id IS NOT NULL;

ALTER TABLE admin_prompt_presets ENABLE ROW LEVEL SECURITY;

-- Admin-only access policy (shared library across all admins).
CREATE POLICY "Admins can manage prompt presets" ON admin_prompt_presets
  USING (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Keep updated_at current
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS update_admin_prompt_presets_updated_at ON admin_prompt_presets;
    CREATE TRIGGER update_admin_prompt_presets_updated_at
      BEFORE UPDATE ON admin_prompt_presets
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE admin_prompt_presets IS 'Admin-only saved prompt presets from the Gemini image generator harness (no images stored)';
COMMENT ON COLUMN admin_prompt_presets.helper_values IS 'Prompt helper structured values (JSONB) used to build the helper instruction block';



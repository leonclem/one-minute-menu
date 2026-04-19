-- ============================================================================
-- Migration 063: Add require_admin_approval feature flag
-- Controls whether new registrants require admin approval to access the app
-- ============================================================================

-- Insert the require_admin_approval flag (enabled by default to maintain current behavior)
INSERT INTO feature_flags (id, enabled)
VALUES ('require_admin_approval', true)
ON CONFLICT (id) DO NOTHING;

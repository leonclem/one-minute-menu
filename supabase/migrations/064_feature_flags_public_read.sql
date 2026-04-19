-- ============================================================================
-- Migration 064: Loosen feature_flags RLS to allow public read access
-- Feature flags are global configuration, not sensitive user data
-- ============================================================================

-- Add policy allowing anyone to read feature flags
CREATE POLICY "Anyone can read feature flags" ON feature_flags
    FOR SELECT USING (true);

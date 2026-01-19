-- Migration 033: Track actual magic-link completion
-- Purpose:
-- - Supabase can create auth.users + profiles at OTP request time (before the link is clicked).
-- - We need a reliable, app-owned signal that the user actually completed /auth/callback.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_profiles_last_login_at ON profiles(last_login_at);

COMMENT ON COLUMN profiles.last_login_at IS 'Timestamp of most recent successful /auth/callback (magic link click / session exchange)';


-- Persist the user's choice to hide the initial Photo Studio guidance panel.
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS studio_first_run_dismissed BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN profiles.studio_first_run_dismissed IS
    'Whether the user has chosen not to see the initial Photo Studio guidance again.';

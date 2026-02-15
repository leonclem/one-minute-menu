-- Migration: Allow demo export jobs (user_id and menu_id nullable)
-- Demo jobs are created by unauthenticated users for the demo flow.
-- Workers process them and upload to deterministic cache paths.

-- Allow NULL for demo jobs (FK allows NULL - no reference)
ALTER TABLE export_jobs
  ALTER COLUMN user_id DROP NOT NULL,
  ALTER COLUMN menu_id DROP NOT NULL;

-- Update RLS: allow unauthenticated users to SELECT demo jobs (for polling by job_id)
-- Drop and recreate the select policy
DROP POLICY IF EXISTS export_jobs_select_own ON export_jobs;
CREATE POLICY export_jobs_select_own
ON export_jobs FOR SELECT
USING (auth.uid() = user_id OR user_id IS NULL);

-- Update insert policy: allow inserting demo jobs with user_id NULL
-- (Service role bypasses RLS, but this allows consistency if needed)
DROP POLICY IF EXISTS export_jobs_insert_own ON export_jobs;
CREATE POLICY export_jobs_insert_own
ON export_jobs FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

COMMENT ON COLUMN export_jobs.user_id IS 'User ID for authenticated jobs; NULL for demo jobs';
COMMENT ON COLUMN export_jobs.menu_id IS 'Menu ID for authenticated jobs; NULL for demo jobs';

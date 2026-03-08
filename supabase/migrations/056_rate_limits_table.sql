-- Migration 056: Database-backed rate limiting
-- Replaces in-memory rate limiting for production reliability
-- Persists across server restarts and works in serverless environments
--
-- Rate limit configs (enforced in src/lib/rate-limiting.ts):
--   image_generation: Free 5/min, Grid+ 15/min, Premium 30/min
--   export:           Free 3/min (5min cooldown), Grid+ 10/min (1min), Premium 20/min (30s)
--
-- Generation quotas (enforced in src/lib/quota-management.ts via PLAN_CONFIGS):
--   Free Creator Pack: 50 total, Paid Creator Pack: +200 each, Grid+: 300/month, Premium: 1,000/month

CREATE TABLE IF NOT EXISTS rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, action_type, window_start)
);

COMMENT ON TABLE rate_limits IS 'Database-backed sliding-window rate limiting for API endpoints';
COMMENT ON COLUMN rate_limits.action_type IS 'Rate limit category, e.g. image_generation, export';
COMMENT ON COLUMN rate_limits.request_count IS 'Number of requests within the current window';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the rate limit window';
COMMENT ON COLUMN rate_limits.window_end IS 'End of the rate limit window (requests after this start a new window)';

CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
  ON rate_limits(user_id, action_type, window_end);

-- RLS: users can only see/modify their own rate limit records
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits"
  ON rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (used by API routes via service role client)
CREATE POLICY "Service role full access on rate_limits"
  ON rate_limits FOR ALL
  USING (true)
  WITH CHECK (true);

-- Cleanup function: delete expired rate limit entries older than 7 days
-- Can be called by a cron job or pg_cron
CREATE OR REPLACE FUNCTION cleanup_expired_rate_limits()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM rate_limits
  WHERE window_end < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_rate_limits IS 'Removes expired rate limit rows older than 7 days. Run via cron or manually.';

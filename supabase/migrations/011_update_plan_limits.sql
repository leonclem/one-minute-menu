-- Update plan limits to include AI image generation quotas
-- Migration 011: Add aiImageGenerations to plan_limits JSONB

-- Update existing profiles to include AI image generation limits
UPDATE profiles 
SET plan_limits = plan_limits || 
  CASE plan
    WHEN 'free' THEN '{"aiImageGenerations": 10}'::jsonb
    WHEN 'premium' THEN '{"aiImageGenerations": 100}'::jsonb
    WHEN 'enterprise' THEN '{"aiImageGenerations": 1000}'::jsonb
    ELSE '{"aiImageGenerations": 10}'::jsonb
  END
WHERE NOT (plan_limits ? 'aiImageGenerations');

-- Update the default plan_limits for new users
ALTER TABLE profiles 
ALTER COLUMN plan_limits 
SET DEFAULT '{"menus": 1, "items": 20, "ocr_jobs": 5, "monthly_uploads": 10, "aiImageGenerations": 10}';

COMMENT ON COLUMN profiles.plan_limits IS 'JSONB containing plan limits including menus, items, ocr_jobs, monthly_uploads, and aiImageGenerations';
-- Migration 045: Increase free plan item limit to 100
-- This aligns DB-stored profile plan_limits with updated application defaults.

-- 1) Update existing free users that are still on the legacy default (20 items)
UPDATE public.profiles
SET plan_limits = jsonb_set(
  COALESCE(plan_limits, '{}'::jsonb),
  '{items}',
  '100'::jsonb,
  true
)
WHERE plan = 'free'
  AND (
    (plan_limits ? 'items') IS FALSE
    OR (plan_limits->>'items')::int = 20
  );

-- 2) Update the column default for new users
ALTER TABLE public.profiles
ALTER COLUMN plan_limits
SET DEFAULT '{"menus": 1, "items": 100, "ocr_jobs": 5, "monthly_uploads": 10, "aiImageGenerations": 10}';


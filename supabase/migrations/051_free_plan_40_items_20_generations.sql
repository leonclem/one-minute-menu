-- Migration 051: Free plan limits — 40 menu items, 20 AI image generations per month
-- Aligns DB-stored plan_limits and generation_quotas with application defaults.

-- 1) Update existing free users: set items to 40 and ai_image_generations to 20
UPDATE public.profiles
SET plan_limits = jsonb_set(
  jsonb_set(
    COALESCE(plan_limits, '{}'::jsonb),
    '{items}',
    '40'::jsonb,
    true
  ),
  '{ai_image_generations}',
  '20'::jsonb,
  true
)
WHERE plan = 'free';

-- 2) Update the column default for new profiles (free plan defaults)
ALTER TABLE public.profiles
ALTER COLUMN plan_limits
SET DEFAULT '{"menus": 1, "items": 40, "ocr_jobs": 5, "monthly_uploads": 10, "aiImageGenerations": 20}';

-- 3) Align generation_quotas for free users to 20 monthly
UPDATE public.generation_quotas
SET monthly_limit = 20,
    updated_at = NOW()
WHERE plan = 'free'
  AND monthly_limit != 20;

-- 4) Update trigger so new free users get monthly_limit 20 (not 100)
CREATE OR REPLACE FUNCTION public.initialize_generation_quota()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('request.jwt.claims', json_build_object('sub', NEW.id::text)::text, true);
    INSERT INTO public.generation_quotas (user_id, plan, monthly_limit, reset_date)
    VALUES (
        NEW.id,
        NEW.plan,
        CASE
            WHEN NEW.plan = 'free' THEN 20
            WHEN NEW.plan IN ('grid_plus', 'premium') THEN 100
            ELSE 1000
        END,
        (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        monthly_limit = EXCLUDED.monthly_limit;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- 5) Update plan-change sync so downgrade to free sets monthly_limit 20
CREATE OR REPLACE FUNCTION public.update_generation_quota_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.plan IS DISTINCT FROM NEW.plan THEN
        UPDATE public.generation_quotas
        SET
            plan = NEW.plan,
            monthly_limit = CASE
                WHEN NEW.plan = 'free' THEN 20
                WHEN NEW.plan IN ('grid_plus', 'premium') THEN 100
                ELSE 1000
            END,
            updated_at = NOW()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

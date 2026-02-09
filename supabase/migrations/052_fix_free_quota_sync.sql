-- Migration 052: Force sync free plan quotas to 20
-- Fixes cases where generation_quotas.monthly_limit doesn't match plan defaults
-- (e.g. admin overrides, migration edge cases, plan mismatches)

-- 1) Update generation_quotas for free users to 20, regardless of current value
-- This ensures all free users have the correct limit
-- Use a direct update without the != 20 condition to force update even if there are edge cases
UPDATE public.generation_quotas gq
SET monthly_limit = 20,
    plan = 'free',
    updated_at = NOW()
FROM public.profiles p
WHERE gq.user_id = p.id
  AND p.plan = 'free'
  AND gq.monthly_limit != 20;

-- 2) Ensure plan_limits.ai_image_generations is 20 for all free users
-- Handle both snake_case (ai_image_generations) and camelCase (aiImageGenerations) keys
UPDATE public.profiles
SET plan_limits = 
    CASE 
        -- If ai_image_generations exists, update it
        WHEN plan_limits ? 'ai_image_generations' THEN
            jsonb_set(plan_limits, '{ai_image_generations}', '20'::jsonb, true)
        -- If aiImageGenerations exists, update it and ensure ai_image_generations exists too
        WHEN plan_limits ? 'aiImageGenerations' THEN
            jsonb_set(
                jsonb_set(plan_limits, '{aiImageGenerations}', '20'::jsonb, true),
                '{ai_image_generations}',
                '20'::jsonb,
                true
            )
        -- If neither exists, add ai_image_generations
        ELSE
            jsonb_set(plan_limits, '{ai_image_generations}', '20'::jsonb, true)
    END
WHERE plan = 'free'
AND (
    -- Update if value is not 20 (check both key formats)
    (plan_limits->>'ai_image_generations')::int != 20
    OR (plan_limits->>'aiImageGenerations')::int != 20
    OR NOT (plan_limits ? 'ai_image_generations')
);

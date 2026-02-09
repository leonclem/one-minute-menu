-- Direct fix for a specific user's quota
-- Replace the user_id below with the actual user ID

-- Option 1: Update via user_id directly (bypasses any subquery issues)
UPDATE public.generation_quotas
SET monthly_limit = 20,
    plan = 'free',
    updated_at = NOW()
WHERE user_id = '20606e6a-f3b3-49d5-803d-64bd77e65611';

-- Option 2: Verify the update worked
SELECT user_id, plan, monthly_limit, current_usage, updated_at
FROM public.generation_quotas
WHERE user_id = '20606e6a-f3b3-49d5-803d-64bd77e65611';

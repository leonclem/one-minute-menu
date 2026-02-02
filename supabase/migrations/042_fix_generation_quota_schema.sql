-- Migration 042: Fix generation_quotas schema reference
-- The initialize_generation_quota trigger fails because it does not explicitly reference the public schema
-- and the search_path during auth events may not include public.

CREATE OR REPLACE FUNCTION public.initialize_generation_quota()
RETURNS TRIGGER AS $$
BEGIN
    -- Temporarily disable RLS for this transaction to allow quota initialization
    -- This is safe because the function is SECURITY DEFINER and only inserts for NEW.id
    PERFORM set_config('request.jwt.claims', json_build_object('sub', NEW.id::text)::text, true);
    
    INSERT INTO public.generation_quotas (user_id, plan, monthly_limit, reset_date)
    VALUES (
        NEW.id, 
        NEW.plan,
        CASE 
            WHEN NEW.plan = 'free' THEN 100
            WHEN NEW.plan IN ('grid_plus', 'premium') THEN 100
            ELSE 1000 -- grid_plus_premium, enterprise
        END,
        (DATE_TRUNC('month', NOW()) + INTERVAL '1 month')::DATE
    )
    ON CONFLICT (user_id) DO UPDATE SET
        plan = EXCLUDED.plan,
        monthly_limit = EXCLUDED.monthly_limit;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

COMMENT ON FUNCTION public.initialize_generation_quota() 
    IS 'Initializes generation quota for new users, bypassing RLS by setting JWT claims. Explicitly uses public schema.';

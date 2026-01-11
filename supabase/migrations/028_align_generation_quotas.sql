-- Migration 028: Align generation_quotas with new plan types and limits
-- Updates constraints and triggers to match the new pricing model

-- 1. Update the plan check constraint on generation_quotas
ALTER TABLE generation_quotas DROP CONSTRAINT IF EXISTS generation_quotas_plan_check;
ALTER TABLE generation_quotas ADD CONSTRAINT generation_quotas_plan_check 
    CHECK (plan IN ('free', 'grid_plus', 'grid_plus_premium', 'premium', 'enterprise'));

-- 2. Update the initialization function for new users
-- This ensures every new profile gets the correct starting quota (100 for free trial)
CREATE OR REPLACE FUNCTION initialize_generation_quota()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO generation_quotas (user_id, plan, monthly_limit, reset_date)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Update the plan-change sync function
-- Ensures that when a user upgrades/downgrades, their image quota is updated too
CREATE OR REPLACE FUNCTION update_generation_quota_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.plan != NEW.plan THEN
        UPDATE generation_quotas 
        SET 
            plan = NEW.plan,
            monthly_limit = CASE 
                WHEN NEW.plan = 'free' THEN 100
                WHEN NEW.plan IN ('grid_plus', 'premium') THEN 100
                ELSE 1000 -- grid_plus_premium, enterprise
            END,
            updated_at = NOW()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Apply the new limits to existing quotas immediately
UPDATE generation_quotas
SET monthly_limit = CASE 
    WHEN plan = 'free' THEN 100
    WHEN plan IN ('grid_plus', 'premium') THEN 100
    ELSE 1000 
END,
updated_at = NOW();

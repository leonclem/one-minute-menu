-- Create the missing generation_quotas table

CREATE TABLE IF NOT EXISTS generation_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    
    -- Plan and limits
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('free', 'premium', 'enterprise')),
    monthly_limit INTEGER NOT NULL,
    current_usage INTEGER DEFAULT 0 CHECK (current_usage >= 0),
    
    -- Reset tracking
    reset_date DATE NOT NULL,
    last_generation_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_quotas_user ON generation_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_quotas_reset ON generation_quotas(reset_date) WHERE current_usage > 0;
CREATE INDEX IF NOT EXISTS idx_quotas_plan ON generation_quotas(plan);

-- Enable RLS
ALTER TABLE generation_quotas ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own quota" ON generation_quotas 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quota" ON generation_quotas 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quota" ON generation_quotas 
  FOR UPDATE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_generation_quotas_updated_at 
    BEFORE UPDATE ON generation_quotas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create the function to initialize quota
CREATE OR REPLACE FUNCTION initialize_generation_quota()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO generation_quotas (user_id, plan, monthly_limit, reset_date)
    VALUES (
        NEW.id, 
        NEW.plan,
        CASE NEW.plan
            WHEN 'free' THEN 10
            WHEN 'premium' THEN 100
            WHEN 'enterprise' THEN 1000
            ELSE 10
        END,
        DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles
CREATE TRIGGER on_profile_created_init_quota
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION initialize_generation_quota();

SELECT 'generation_quotas table and triggers created successfully' as status;

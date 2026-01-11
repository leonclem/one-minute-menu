-- Pricing and Subscription Overhaul Migration
-- Migration 027: Updates profiles, adds user_packs and purchase_audit

-- 1. Update profiles table plan constraint
-- Note: We use a multi-step approach to safely update the check constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_plan_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_plan_check CHECK (plan IN ('free', 'grid_plus', 'grid_plus_premium', 'premium', 'enterprise'));

-- 2. Create user_packs table to track Creator Packs (one-time purchases)
CREATE TABLE user_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    pack_type VARCHAR(50) NOT NULL DEFAULT 'creator_pack',
    purchase_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '24 months'),
    edit_window_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 week'),
    is_free_trial BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_packs
ALTER TABLE user_packs ENABLE ROW LEVEL SECURITY;

-- RLS Policy for user_packs
CREATE POLICY "Users can view own packs" ON user_packs 
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Create purchase_audit table for logging transactions
CREATE TABLE purchase_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    transaction_id VARCHAR(255), -- Stripe transaction ID
    product_id VARCHAR(255) NOT NULL,
    amount_cents INTEGER NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL, -- 'success', 'refunded', 'failed'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on purchase_audit
ALTER TABLE purchase_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy for purchase_audit (Admin only view, user can't see audit trail directly for security)
CREATE POLICY "Admins can view all purchase audits" ON purchase_audit 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 4. Update handle_new_user to grant free Creator Pack
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create the profile
    INSERT INTO public.profiles (id, email, plan)
    VALUES (NEW.id, NEW.email, 'free');

    -- Grant one free Creator Pack (First Pack free)
    INSERT INTO public.user_packs (user_id, pack_type, is_free_trial, edit_window_end)
    VALUES (NEW.id, 'creator_pack', TRUE, NOW() + INTERVAL '1 week');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Indexes for performance
CREATE INDEX idx_user_packs_user_id ON user_packs(user_id);
CREATE INDEX idx_purchase_audit_user_id ON purchase_audit(user_id);
CREATE INDEX idx_purchase_audit_transaction_id ON purchase_audit(transaction_id);

-- 6. Comments
COMMENT ON TABLE user_packs IS 'Tracks one-time menu packs purchased by users';
COMMENT ON TABLE purchase_audit IS 'Auditable log of all financial transactions and product grants';

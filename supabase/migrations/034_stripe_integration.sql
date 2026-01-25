-- Stripe Payment Integration Migration
-- Migration 034: Add Stripe-related columns and webhook tracking

-- 1. Extend profiles table with Stripe fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP WITH TIME ZONE;

-- Add indexes for performance on profiles table
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription ON profiles(stripe_subscription_id);

-- Add comments for documentation
COMMENT ON COLUMN profiles.stripe_customer_id IS 'Stripe Customer ID for billing';
COMMENT ON COLUMN profiles.stripe_subscription_id IS 'Active Stripe Subscription ID';
COMMENT ON COLUMN profiles.subscription_status IS 'Subscription status: active, past_due, canceled, incomplete, trialing';
COMMENT ON COLUMN profiles.subscription_period_end IS 'When current subscription period ends';

-- 2. Create webhook_events table for logging and idempotency
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    stripe_event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    retry_count INTEGER DEFAULT 0,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE
);

-- Add indexes for webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_id ON webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_type_processed ON webhook_events(event_type, processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created ON webhook_events(created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE webhook_events IS 'Log of all Stripe webhook events for debugging and idempotency';

-- 3. Enable RLS on webhook_events (admin-only access)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policy for webhook_events (Admin only)
CREATE POLICY "Admins can view all webhook events" ON webhook_events 
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
        )
    );

-- 4. Add indexes to purchase_audit for idempotency checks
-- Note: purchase_audit table already exists from migration 027
CREATE INDEX IF NOT EXISTS idx_purchase_audit_transaction_status 
    ON purchase_audit(transaction_id, status);

CREATE INDEX IF NOT EXISTS idx_purchase_audit_user_created 
    ON purchase_audit(user_id, created_at DESC);


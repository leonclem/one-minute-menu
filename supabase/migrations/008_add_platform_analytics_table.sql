-- Migration: Add missing platform_analytics table
-- Date: 2025-10-07
-- This table was defined in the initial schema but may be missing from production

-- Create platform_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS platform_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, metric_name)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_platform_analytics_date ON platform_analytics(date);
CREATE INDEX IF NOT EXISTS idx_platform_analytics_metric_name ON platform_analytics(metric_name);

-- Add comment
COMMENT ON TABLE platform_analytics IS 'Platform-wide metrics for admin monitoring (no RLS - admin only)';
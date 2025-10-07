-- Migration: Add missing analytics and abuse reporting tables
-- Date: 2025-10-07
-- These tables were defined in the initial schema but are missing from production

-- Create menu_analytics table if it doesn't exist
CREATE TABLE IF NOT EXISTS menu_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    unique_visitors_ids TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(menu_id, date)
);

-- Enable RLS on menu_analytics
ALTER TABLE menu_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_analytics
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'menu_analytics' 
        AND policyname = 'Users can view own menu analytics'
    ) THEN
        CREATE POLICY "Users can view own menu analytics" ON menu_analytics 
            USING (auth.uid() = (SELECT user_id FROM menus WHERE id = menu_id));
    END IF;
END $$;

-- Create geographic_usage table if it doesn't exist
CREATE TABLE IF NOT EXISTS geographic_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    registrations INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, country_code)
);

-- Create abuse_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS abuse_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('brand_impersonation', 'inappropriate_content', 'spam', 'other')),
    description TEXT NOT NULL,
    reporter_email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved', 'dismissed')),
    admin_notes TEXT,
    resolved_at TIMESTAMP,
    resolved_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_menu_analytics_menu_id ON menu_analytics(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_analytics_date ON menu_analytics(date);
CREATE INDEX IF NOT EXISTS idx_geographic_usage_date ON geographic_usage(date);
CREATE INDEX IF NOT EXISTS idx_geographic_usage_country ON geographic_usage(country_code);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_menu_id ON abuse_reports(menu_id);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_created_at ON abuse_reports(created_at);

-- Add comments
COMMENT ON TABLE menu_analytics IS 'Cookieless analytics for menu views';
COMMENT ON TABLE geographic_usage IS 'Geographic usage tracking for compliance';
COMMENT ON TABLE abuse_reports IS 'Reports of abuse, brand impersonation, or inappropriate content';
COMMENT ON COLUMN menu_analytics.unique_visitors_ids IS 'Array of rotating daily visitor IDs for approximate unique visitor counts (cookieless)';
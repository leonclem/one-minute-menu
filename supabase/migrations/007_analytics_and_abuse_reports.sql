-- Migration: Add analytics tracking and abuse reporting tables
-- Date: 2025-01-04

-- Add unique_visitors_ids column to menu_analytics for tracking rotating visitor IDs
ALTER TABLE menu_analytics ADD COLUMN IF NOT EXISTS unique_visitors_ids TEXT[] DEFAULT '{}';

-- Create abuse_reports table for content moderation
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
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_abuse_reports_menu_id ON abuse_reports(menu_id);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_status ON abuse_reports(status);
CREATE INDEX IF NOT EXISTS idx_abuse_reports_created_at ON abuse_reports(created_at);

-- Add comment
COMMENT ON TABLE abuse_reports IS 'Reports of abuse, brand impersonation, or inappropriate content';
COMMENT ON COLUMN menu_analytics.unique_visitors_ids IS 'Array of rotating daily visitor IDs for approximate unique visitor counts (cookieless)';

-- No RLS on abuse_reports - public can submit, only admins can view
-- In production, add proper admin role checks

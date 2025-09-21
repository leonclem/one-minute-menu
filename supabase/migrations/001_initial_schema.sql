-- QR Menu System Database Schema
-- This creates the initial database structure for the MVP

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    plan VARCHAR(20) DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
    plan_limits JSONB DEFAULT '{"menus": 1, "items": 20, "ocr_jobs": 5, "monthly_uploads": 10}',
    location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles 
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles 
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles 
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Menus table (stores everything as JSONB for MVP simplicity)
CREATE TABLE menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    current_version INTEGER DEFAULT 1,
    menu_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Unique constraint: slug is unique per user, not globally
    UNIQUE(user_id, slug)
);

-- Enable RLS on menus
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menus
CREATE POLICY "Users can manage own menus" ON menus 
    USING (auth.uid() = user_id);

-- Menu Versions (for rollback functionality)
CREATE TABLE menu_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    version INTEGER NOT NULL,
    menu_data JSONB NOT NULL,
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(menu_id, version)
);

-- Enable RLS on menu_versions
ALTER TABLE menu_versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_versions
CREATE POLICY "Users can view own menu versions" ON menu_versions 
    USING (auth.uid() = (SELECT user_id FROM menus WHERE id = menu_id));

-- OCR Jobs table (for image processing queue)
CREATE TABLE ocr_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    image_hash VARCHAR(64) NOT NULL, -- SHA-256 hash for idempotency
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    result JSONB,
    error_message TEXT,
    processing_time INTEGER, -- in milliseconds
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on ocr_jobs
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ocr_jobs
CREATE POLICY "Users can view own OCR jobs" ON ocr_jobs 
    USING (auth.uid() = user_id);

-- Audit trail for menu changes and support
CREATE TABLE menu_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN ('created', 'updated', 'published', 'reverted', 'deleted')),
    changes JSONB,
    version INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on menu_audit
ALTER TABLE menu_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_audit
CREATE POLICY "Users can view own menu audit" ON menu_audit 
    USING (auth.uid() = user_id);

-- Reserved slugs to prevent conflicts with system routes and major brands
CREATE TABLE reserved_slugs (
    slug VARCHAR(255) PRIMARY KEY,
    reason VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert system reserved slugs
INSERT INTO reserved_slugs (slug, reason) VALUES 
    ('admin', 'system'),
    ('api', 'system'),
    ('app', 'system'),
    ('support', 'system'),
    ('help', 'system'),
    ('about', 'system'),
    ('privacy', 'system'),
    ('terms', 'system'),
    ('login', 'system'),
    ('signup', 'system'),
    ('dashboard', 'system'),
    ('settings', 'system'),
    ('profile', 'system'),
    ('billing', 'system'),
    ('upgrade', 'system'),
    -- Major brand protection
    ('mcdonalds', 'brand protection'),
    ('kfc', 'brand protection'),
    ('subway', 'brand protection'),
    ('starbucks', 'brand protection'),
    ('pizzahut', 'brand protection'),
    ('dominos', 'brand protection'),
    ('burgerking', 'brand protection');

-- Simple analytics (cookieless, aggregated only)
CREATE TABLE menu_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0, -- Estimated via rotating localStorage identifier
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(menu_id, date)
);

-- Enable RLS on menu_analytics
ALTER TABLE menu_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for menu_analytics
CREATE POLICY "Users can view own menu analytics" ON menu_analytics 
    USING (auth.uid() = (SELECT user_id FROM menus WHERE id = menu_id));

-- Platform analytics for admin monitoring (no RLS - admin only)
CREATE TABLE platform_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value INTEGER NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, metric_name)
);

-- Geographic usage tracking for potential restrictions (no RLS - admin only)
CREATE TABLE geographic_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    registrations INTEGER DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(date, country_code)
);

-- Functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_menus_updated_at 
    BEFORE UPDATE ON menus 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create profile on user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Indexes for performance
CREATE INDEX idx_menus_user_id ON menus(user_id);
CREATE INDEX idx_menus_status ON menus(status);
CREATE INDEX idx_menus_slug ON menus(user_id, slug);
CREATE INDEX idx_menu_versions_menu_id ON menu_versions(menu_id);
CREATE INDEX idx_menu_audit_menu_id ON menu_audit(menu_id);
CREATE INDEX idx_menu_audit_user_id ON menu_audit(user_id);
CREATE INDEX idx_menu_analytics_menu_id ON menu_analytics(menu_id);
CREATE INDEX idx_menu_analytics_date ON menu_analytics(date);
CREATE INDEX idx_ocr_jobs_status ON ocr_jobs(status);
CREATE INDEX idx_ocr_jobs_user_id ON ocr_jobs(user_id);
CREATE INDEX idx_ocr_jobs_image_hash ON ocr_jobs(image_hash);

-- JSONB indexes for menu data queries (GIN indexes for better performance)
CREATE INDEX idx_menus_menu_data_gin ON menus USING GIN (menu_data);
CREATE INDEX idx_menu_versions_menu_data_gin ON menu_versions USING GIN (menu_data);
CREATE INDEX idx_ocr_jobs_result_gin ON ocr_jobs USING GIN (result);

-- Enable realtime for OCR job updates
ALTER PUBLICATION supabase_realtime ADD TABLE ocr_jobs;

-- Comments for documentation
COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users with plan information';
COMMENT ON TABLE menus IS 'Restaurant menus with JSONB data for flexibility';
COMMENT ON TABLE menu_versions IS 'Menu version history for rollback functionality';
COMMENT ON TABLE ocr_jobs IS 'OCR processing job queue with LISTEN/NOTIFY support';
COMMENT ON TABLE menu_audit IS 'Audit trail for menu changes and support';
COMMENT ON TABLE reserved_slugs IS 'Reserved slugs to prevent conflicts';
COMMENT ON TABLE menu_analytics IS 'Cookieless analytics for menu views';
COMMENT ON TABLE platform_analytics IS 'Platform-wide metrics for admin monitoring';
COMMENT ON TABLE geographic_usage IS 'Geographic usage tracking for compliance';
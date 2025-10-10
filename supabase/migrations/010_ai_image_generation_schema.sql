-- AI Image Generation Feature Schema
-- Migration 010: Add tables and columns for AI-powered menu image generation

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create menu_items table to normalize menu data for image associations
-- This extracts individual items from the JSONB menu_data for better relational structure
CREATE TABLE menu_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_id UUID REFERENCES menus(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    category VARCHAR(100),
    available BOOLEAN DEFAULT true,
    order_index INTEGER DEFAULT 0,
    
    -- Image-related fields
    ai_image_id UUID, -- References ai_generated_images(id), set after creation
    custom_image_url VARCHAR(500),
    image_source VARCHAR(20) DEFAULT 'none' CHECK (image_source IN ('none', 'ai', 'custom')),
    generation_params JSONB,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique ordering within menu
    UNIQUE(menu_id, order_index)
);

-- AI Generated Images table
CREATE TABLE ai_generated_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
    generation_job_id UUID, -- References image_generation_jobs(id), set after job creation
    
    -- Image URLs for different formats and sizes
    original_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500) NOT NULL,
    mobile_url VARCHAR(500) NOT NULL,
    desktop_url VARCHAR(500) NOT NULL,
    webp_url VARCHAR(500),
    
    -- Generation metadata
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    aspect_ratio VARCHAR(10) DEFAULT '1:1',
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    selected BOOLEAN DEFAULT false,
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Image Generation Jobs table
CREATE TABLE image_generation_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
    
    -- Job status and configuration
    status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    api_params JSONB NOT NULL DEFAULT '{}',
    number_of_variations INTEGER DEFAULT 1 CHECK (number_of_variations BETWEEN 1 AND 4),
    
    -- Results and metrics
    result_count INTEGER DEFAULT 0,
    error_message TEXT,
    error_code VARCHAR(50),
    processing_time INTEGER, -- milliseconds
    estimated_cost DECIMAL(10, 4),
    retry_count INTEGER DEFAULT 0 CHECK (retry_count >= 0),
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Generation Quota Tracking
CREATE TABLE generation_quotas (
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

-- Generation Analytics for monitoring and cost tracking
CREATE TABLE generation_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    
    -- Usage metrics
    successful_generations INTEGER DEFAULT 0 CHECK (successful_generations >= 0),
    failed_generations INTEGER DEFAULT 0 CHECK (failed_generations >= 0),
    total_variations INTEGER DEFAULT 0 CHECK (total_variations >= 0),
    estimated_cost DECIMAL(10, 4) DEFAULT 0,
    avg_processing_time INTEGER, -- milliseconds
    
    -- Additional metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(user_id, date)
);

-- Add foreign key constraint after ai_generated_images table is created
ALTER TABLE menu_items 
ADD CONSTRAINT fk_menu_items_ai_image 
FOREIGN KEY (ai_image_id) REFERENCES ai_generated_images(id) ON DELETE SET NULL;

-- Add foreign key constraint after image_generation_jobs table is created
ALTER TABLE ai_generated_images 
ADD CONSTRAINT fk_ai_images_generation_job 
FOREIGN KEY (generation_job_id) REFERENCES image_generation_jobs(id) ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX idx_menu_items_image_source ON menu_items(image_source) WHERE image_source != 'none';
CREATE INDEX idx_menu_items_ai_image ON menu_items(ai_image_id) WHERE ai_image_id IS NOT NULL;
CREATE INDEX idx_menu_items_order ON menu_items(menu_id, order_index);

CREATE INDEX idx_ai_images_menu_item ON ai_generated_images(menu_item_id);
CREATE INDEX idx_ai_images_selected ON ai_generated_images(menu_item_id, selected) WHERE selected = true;
CREATE INDEX idx_ai_images_job ON ai_generated_images(generation_job_id) WHERE generation_job_id IS NOT NULL;

CREATE INDEX idx_gen_jobs_user ON image_generation_jobs(user_id);
CREATE INDEX idx_gen_jobs_status ON image_generation_jobs(status) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_gen_jobs_menu_item ON image_generation_jobs(menu_item_id);
CREATE INDEX idx_gen_jobs_created ON image_generation_jobs(created_at);

CREATE INDEX idx_quotas_user ON generation_quotas(user_id);
CREATE INDEX idx_quotas_reset ON generation_quotas(reset_date) WHERE current_usage > 0;
CREATE INDEX idx_quotas_plan ON generation_quotas(plan);

CREATE INDEX idx_gen_analytics_user_date ON generation_analytics(user_id, date);
CREATE INDEX idx_gen_analytics_date ON generation_analytics(date);

-- JSONB indexes for better query performance
CREATE INDEX idx_menu_items_generation_params_gin ON menu_items USING GIN (generation_params) WHERE generation_params IS NOT NULL;
CREATE INDEX idx_gen_jobs_api_params_gin ON image_generation_jobs USING GIN (api_params);
CREATE INDEX idx_ai_images_metadata_gin ON ai_generated_images USING GIN (metadata);
CREATE INDEX idx_gen_analytics_metadata_gin ON generation_analytics USING GIN (metadata);

-- Row Level Security (RLS) policies
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage menu items for own menus" ON menu_items 
  USING (
    menu_id IN (
      SELECT id FROM menus WHERE user_id = auth.uid()
    )
  );

ALTER TABLE ai_generated_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generated images" ON ai_generated_images 
  FOR SELECT USING (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m ON mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert generated images for own items" ON ai_generated_images 
  FOR INSERT WITH CHECK (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m ON mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own generated images" ON ai_generated_images 
  FOR UPDATE USING (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m ON mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own generated images" ON ai_generated_images 
  FOR DELETE USING (
    menu_item_id IN (
      SELECT mi.id FROM menu_items mi 
      JOIN menus m on mi.menu_id = m.id 
      WHERE m.user_id = auth.uid()
    )
  );

ALTER TABLE image_generation_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own generation jobs" ON image_generation_jobs 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own generation jobs" ON image_generation_jobs 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own generation jobs" ON image_generation_jobs 
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE generation_quotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own quota" ON generation_quotas 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own quota" ON generation_quotas 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own quota" ON generation_quotas 
  FOR UPDATE USING (auth.uid() = user_id);

ALTER TABLE generation_analytics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own analytics" ON generation_analytics 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own analytics" ON generation_analytics 
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own analytics" ON generation_analytics 
  FOR UPDATE USING (auth.uid() = user_id);

-- Triggers for automatic timestamp updates
CREATE TRIGGER update_menu_items_updated_at 
    BEFORE UPDATE ON menu_items 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_generation_quotas_updated_at 
    BEFORE UPDATE ON generation_quotas 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to initialize quota for new users
CREATE OR REPLACE FUNCTION initialize_generation_quota()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO generation_quotas (user_id, plan, monthly_limit, reset_date)
    VALUES (
        NEW.id, 
        COALESCE((SELECT plan FROM profiles WHERE id = NEW.id), 'free'),
        CASE 
            WHEN COALESCE((SELECT plan FROM profiles WHERE id = NEW.id), 'free') = 'free' THEN 10
            WHEN COALESCE((SELECT plan FROM profiles WHERE id = NEW.id), 'free') = 'premium' THEN 100
            ELSE 1000 -- enterprise
        END,
        DATE_TRUNC('month', NOW()) + INTERVAL '1 month'
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to initialize quota when user profile is created
CREATE TRIGGER on_profile_created_init_quota
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION initialize_generation_quota();

-- Function to update quota when plan changes
CREATE OR REPLACE FUNCTION update_generation_quota_on_plan_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.plan != NEW.plan THEN
        UPDATE generation_quotas 
        SET 
            plan = NEW.plan,
            monthly_limit = CASE 
                WHEN NEW.plan = 'free' THEN 10
                WHEN NEW.plan = 'premium' THEN 100
                ELSE 1000 -- enterprise
            END,
            updated_at = NOW()
        WHERE user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update quota when user plan changes
CREATE TRIGGER on_plan_change_update_quota
    AFTER UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_generation_quota_on_plan_change();

-- Function to reset monthly quotas (to be called by cron job)
CREATE OR REPLACE FUNCTION reset_monthly_quotas()
RETURNS INTEGER AS $$
BEGIN
    UPDATE generation_quotas 
    SET 
        current_usage = 0,
        reset_date = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
        updated_at = NOW()
    WHERE reset_date <= CURRENT_DATE;
    
    RETURN (SELECT COUNT(*) FROM generation_quotas WHERE reset_date <= CURRENT_DATE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable realtime for job status updates
ALTER PUBLICATION supabase_realtime ADD TABLE image_generation_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_generated_images;

-- Comments for documentation
COMMENT ON TABLE menu_items IS 'Individual menu items extracted from JSONB for AI image generation';
COMMENT ON TABLE ai_generated_images IS 'AI-generated images for menu items with multiple format support';
COMMENT ON TABLE image_generation_jobs IS 'Job queue for AI image generation requests';
COMMENT ON TABLE generation_quotas IS 'Monthly quota tracking per user and plan';
COMMENT ON TABLE generation_analytics IS 'Analytics for generation usage and cost tracking';

COMMENT ON COLUMN menu_items.ai_image_id IS 'Reference to selected AI-generated image';
COMMENT ON COLUMN menu_items.custom_image_url IS 'URL for user-uploaded custom image';
COMMENT ON COLUMN menu_items.image_source IS 'Source of current image: none, ai, or custom';
COMMENT ON COLUMN menu_items.generation_params IS 'Stored parameters for image regeneration';

COMMENT ON COLUMN ai_generated_images.selected IS 'Whether this image is currently selected for the menu item';
COMMENT ON COLUMN ai_generated_images.metadata IS 'Additional metadata like generation settings and API response data';

COMMENT ON COLUMN image_generation_jobs.api_params IS 'Parameters sent to Nano Banana API';
COMMENT ON COLUMN image_generation_jobs.estimated_cost IS 'Estimated cost in USD for this generation';
COMMENT ON COLUMN image_generation_jobs.processing_time IS 'Total processing time in milliseconds';

COMMENT ON COLUMN generation_quotas.reset_date IS 'Date when quota will reset (first day of next month)';
COMMENT ON COLUMN generation_analytics.metadata IS 'Additional analytics data like style preferences and error types';
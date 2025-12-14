-- AI Image Generation Feature Schema - Part 1: Tables Only
-- Run this first in Supabase SQL Editor

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create menu_items table to normalize menu data for image associations
CREATE TABLE IF NOT EXISTS menu_items (
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
CREATE TABLE IF NOT EXISTS ai_generated_images (
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
CREATE TABLE IF NOT EXISTS image_generation_jobs (
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

-- Generation Analytics for monitoring and cost tracking
CREATE TABLE IF NOT EXISTS generation_analytics (
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
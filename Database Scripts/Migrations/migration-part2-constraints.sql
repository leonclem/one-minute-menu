-- AI Image Generation Feature Schema - Part 2: Constraints and Indexes
-- Run this after Part 1

-- Add foreign key constraint after ai_generated_images table is created
ALTER TABLE menu_items 
ADD CONSTRAINT fk_menu_items_ai_image 
FOREIGN KEY (ai_image_id) REFERENCES ai_generated_images(id) ON DELETE SET NULL;

-- Add foreign key constraint after image_generation_jobs table is created
ALTER TABLE ai_generated_images 
ADD CONSTRAINT fk_ai_images_generation_job 
FOREIGN KEY (generation_job_id) REFERENCES image_generation_jobs(id) ON DELETE SET NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_menu_items_menu_id ON menu_items(menu_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_image_source ON menu_items(image_source) WHERE image_source != 'none';
CREATE INDEX IF NOT EXISTS idx_menu_items_ai_image ON menu_items(ai_image_id) WHERE ai_image_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_menu_items_order ON menu_items(menu_id, order_index);

CREATE INDEX IF NOT EXISTS idx_ai_images_menu_item ON ai_generated_images(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_ai_images_selected ON ai_generated_images(menu_item_id, selected) WHERE selected = true;
CREATE INDEX IF NOT EXISTS idx_ai_images_job ON ai_generated_images(generation_job_id) WHERE generation_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_gen_jobs_user ON image_generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_status ON image_generation_jobs(status) WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_gen_jobs_menu_item ON image_generation_jobs(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_created ON image_generation_jobs(created_at);

CREATE INDEX IF NOT EXISTS idx_quotas_user ON generation_quotas(user_id);
CREATE INDEX IF NOT EXISTS idx_quotas_reset ON generation_quotas(reset_date) WHERE current_usage > 0;
CREATE INDEX IF NOT EXISTS idx_quotas_plan ON generation_quotas(plan);

CREATE INDEX IF NOT EXISTS idx_gen_analytics_user_date ON generation_analytics(user_id, date);
CREATE INDEX IF NOT EXISTS idx_gen_analytics_date ON generation_analytics(date);

-- JSONB indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_menu_items_generation_params_gin ON menu_items USING GIN (generation_params) WHERE generation_params IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gen_jobs_api_params_gin ON image_generation_jobs USING GIN (api_params);
CREATE INDEX IF NOT EXISTS idx_ai_images_metadata_gin ON ai_generated_images USING GIN (metadata);
CREATE INDEX IF NOT EXISTS idx_gen_analytics_metadata_gin ON generation_analytics USING GIN (metadata);
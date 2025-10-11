-- Quick fix to add missing template_config column
-- Run this in your Supabase SQL editor if you don't want to reset the database

ALTER TABLE menus ADD COLUMN IF NOT EXISTS template_config JSONB;

-- Add index for template_config
CREATE INDEX IF NOT EXISTS idx_menus_template_config_gin ON menus USING GIN (template_config) WHERE template_config IS NOT NULL;

-- Add comment
COMMENT ON COLUMN menus.template_config IS 'Template configuration including custom colors and override settings';

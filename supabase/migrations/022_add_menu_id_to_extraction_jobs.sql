-- Migration 022: Add menu_id column to menu_extraction_jobs
-- This column links extraction jobs to specific menus (optional, as some jobs may be for demo/preview)

-- Add menu_id column (nullable since demo menus don't have IDs)
ALTER TABLE menu_extraction_jobs 
  ADD COLUMN IF NOT EXISTS menu_id UUID REFERENCES menus(id) ON DELETE CASCADE;

-- Create index for menu_id lookups
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_menu_id 
  ON menu_extraction_jobs(menu_id);

-- Add comment for documentation
COMMENT ON COLUMN menu_extraction_jobs.menu_id IS 'Optional reference to menu (null for demo/preview extractions)';

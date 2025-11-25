-- Migration 021: Add extraction_method column to menu_extraction_jobs
-- This column tracks which extraction method was used (vision_llm, ocr, etc.)

-- Add extraction_method column
ALTER TABLE menu_extraction_jobs 
  ADD COLUMN IF NOT EXISTS extraction_method VARCHAR(50) DEFAULT 'vision_llm' NOT NULL;

-- Create index for extraction_method lookups
CREATE INDEX IF NOT EXISTS idx_menu_extraction_jobs_extraction_method 
  ON menu_extraction_jobs(extraction_method);

-- Add comment for documentation
COMMENT ON COLUMN menu_extraction_jobs.extraction_method IS 'Extraction method used (vision_llm, ocr, etc.)';

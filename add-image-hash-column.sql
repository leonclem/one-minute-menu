-- Add missing image_hash column to menu_extraction_jobs

ALTER TABLE menu_extraction_jobs 
  ADD COLUMN IF NOT EXISTS image_hash TEXT;

-- Create index for deduplication
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_image_hash 
  ON menu_extraction_jobs(image_hash) 
  WHERE image_hash IS NOT NULL;

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'menu_extraction_jobs'
ORDER BY ordinal_position;

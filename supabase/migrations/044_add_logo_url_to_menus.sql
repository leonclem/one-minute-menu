-- Add logo_url column to menus table
-- This migration adds support for restaurant logo uploads

-- Add the logo_url column to the menus table
ALTER TABLE menus 
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN menus.logo_url IS 'URL to the restaurant/venue logo image stored in Supabase Storage';

-- Add index for logo_url queries
CREATE INDEX IF NOT EXISTS idx_menus_logo_url ON menus(logo_url) WHERE logo_url IS NOT NULL;

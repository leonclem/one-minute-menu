-- ============================================================================
-- Add default venue info to profiles
-- ============================================================================
-- This allows users to set default contact/social info that will be used
-- when creating new menus

-- Add default_venue_info column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS default_venue_info JSONB DEFAULT '{}'::jsonb;

-- Add comment for documentation
COMMENT ON COLUMN profiles.default_venue_info IS 'Default venue information (address, phone, email, social media) used when creating new menus';

-- Create GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_profiles_default_venue_info_gin 
ON profiles USING GIN (default_venue_info);

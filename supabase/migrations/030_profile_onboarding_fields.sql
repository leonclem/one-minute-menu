-- Add username and onboarding_completed to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS restaurant_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS establishment_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS primary_cuisine VARCHAR(50);

-- Add comments for documentation
COMMENT ON COLUMN profiles.username IS 'Unique username for the user (optional)';
COMMENT ON COLUMN profiles.onboarding_completed IS 'Flag to track if user has completed the onboarding flow';
COMMENT ON COLUMN profiles.restaurant_name IS 'Default restaurant name set during onboarding';
COMMENT ON COLUMN profiles.establishment_type IS 'Default establishment type set during onboarding';
COMMENT ON COLUMN profiles.primary_cuisine IS 'Default primary cuisine set during onboarding';

-- Add index for username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

-- Migration 012: Add user roles for admin access control
-- Requirements: 8.1, 8.2, 8.3

-- Add role column to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Comment for documentation
COMMENT ON COLUMN profiles.role IS 'User role: user (default) or admin (for dashboard access)';

-- Note: The existing RLS policies on profiles table are sufficient.
-- Users can view their own profile via "Users can view own profile" policy.
-- Admin access to other profiles is handled at the application level, not via RLS.

-- Note: To assign admin role to a user, run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

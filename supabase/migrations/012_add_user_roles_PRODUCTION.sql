-- ============================================================================
-- Migration 012: Add user roles for admin access control
-- ============================================================================
-- Requirements: 8.1, 8.2, 8.3
-- 
-- This migration adds role-based access control for admin dashboards.
-- Safe to run multiple times (idempotent).
--
-- IMPORTANT: This does NOT create any RLS policies that could cause
-- infinite recursion. Admin access is handled at the application level.
-- ============================================================================

-- Add role column to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for efficient role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add documentation
COMMENT ON COLUMN profiles.role IS 'User role: user (default) or admin (for dashboard access)';

-- ============================================================================
-- Post-Migration Steps
-- ============================================================================
-- 
-- After running this migration, assign admin role to your admin users:
-- 
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@example.com';
--
-- Verify the migration:
--
-- SELECT column_name, data_type, column_default 
-- FROM information_schema.columns 
-- WHERE table_name = 'profiles' AND column_name = 'role';
--
-- List all admin users:
--
-- SELECT id, email, role, plan, created_at 
-- FROM profiles 
-- WHERE role = 'admin';
-- ============================================================================

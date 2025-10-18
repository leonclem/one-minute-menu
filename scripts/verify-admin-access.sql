-- Verification script for admin access control
-- Run this to verify the admin role system is working correctly

-- ============================================================================
-- 1. Verify migration has been applied
-- ============================================================================

-- Check if role column exists in profiles table
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'role';

-- Expected output: role | character varying | 'user'::character varying | NO

-- ============================================================================
-- 2. Verify index exists
-- ============================================================================

-- Check if role index exists
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'profiles' AND indexname = 'idx_profiles_role';

-- Expected output: idx_profiles_role | CREATE INDEX idx_profiles_role ON public.profiles USING btree (role)

-- ============================================================================
-- 3. Check current role distribution
-- ============================================================================

-- Count users by role
SELECT role, COUNT(*) as user_count
FROM profiles
GROUP BY role
ORDER BY role;

-- Expected output:
-- admin | <number of admins>
-- user  | <number of regular users>

-- ============================================================================
-- 4. List all admin users
-- ============================================================================

-- Show all users with admin role
SELECT id, email, role, plan, created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at DESC;

-- ============================================================================
-- 5. Verify RLS policies
-- ============================================================================

-- Check RLS policies on profiles table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Should include: "Admins can view all profiles"

-- ============================================================================
-- 6. Test role constraint
-- ============================================================================

-- This should fail (invalid role value)
-- Uncomment to test:
-- INSERT INTO profiles (id, email, role) VALUES (gen_random_uuid(), 'test@example.com', 'invalid_role');

-- This should succeed
-- Uncomment to test:
-- INSERT INTO profiles (id, email, role) VALUES (gen_random_uuid(), 'test@example.com', 'user');
-- DELETE FROM profiles WHERE email = 'test@example.com';

-- ============================================================================
-- 7. Summary
-- ============================================================================

SELECT 
  'Admin Access Control Status' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN '✓ Role column exists'
    ELSE '✗ Role column missing'
  END as status;

SELECT 
  'Index Status' as check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'profiles' AND indexname = 'idx_profiles_role'
    ) THEN '✓ Role index exists'
    ELSE '✗ Role index missing'
  END as status;

SELECT 
  'Admin Users' as check_name,
  COUNT(*)::text || ' admin user(s) configured' as status
FROM profiles
WHERE role = 'admin';

-- ============================================================================
-- End of verification script
-- ============================================================================

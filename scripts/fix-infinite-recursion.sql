-- URGENT FIX: Remove the problematic RLS policy causing infinite recursion
-- Run this immediately in your Supabase SQL Editor

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Verify it's gone
SELECT 'Policy removed successfully' as status;

-- Show remaining policies (should be the original 3)
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

-- Expected output: 3 policies
-- 1. "Users can insert own profile"
-- 2. "Users can update own profile"  
-- 3. "Users can view own profile"

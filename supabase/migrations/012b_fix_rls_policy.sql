-- Fix for infinite recursion in RLS policy
-- This removes the problematic "Admins can view all profiles" policy

-- Drop the problematic policy if it exists
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- The existing policies are sufficient:
-- 1. "Users can view own profile" - allows users to see their own profile
-- 2. "Users can update own profile" - allows users to update their own profile
-- 3. "Users can insert own profile" - allows users to create their own profile

-- Admin access to view all profiles is handled at the application level
-- via service role key, not through RLS policies.

-- Verify existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename = 'profiles'
ORDER BY policyname;

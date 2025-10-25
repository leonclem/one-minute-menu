-- Let's see what policies exist on profiles that might be blocking inserts

-- Check all policies on profiles
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd as command,
    qual as using_expression,
    with_check as with_check_expression
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY cmd, policyname;

-- Check if there are duplicate policies
SELECT policyname, COUNT(*) 
FROM pg_policies 
WHERE tablename = 'profiles'
GROUP BY policyname
HAVING COUNT(*) > 1;

-- Check the handle_new_user function to see if it has SECURITY DEFINER
SELECT 
    p.proname as function_name,
    p.prosecdef as has_security_definer,
    pg_get_functiondef(p.oid) as full_definition
FROM pg_proc p
WHERE p.proname = 'handle_new_user';

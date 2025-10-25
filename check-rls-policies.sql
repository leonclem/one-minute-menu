-- Check RLS policies on profiles table

-- Is RLS enabled?
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'profiles';

-- What policies exist?
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'profiles';

-- Check if the function has SECURITY DEFINER (it should bypass RLS)
SELECT 
    proname,
    prosecdef as is_security_definer
FROM pg_proc 
WHERE proname = 'handle_new_user';

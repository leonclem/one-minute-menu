-- Find all policies and check for duplicates

-- All policies on storage.objects
SELECT 
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' AND schemaname = 'storage'
ORDER BY policyname;

-- Check for duplicate policy names
SELECT 
    schemaname,
    tablename,
    policyname,
    COUNT(*) as count
FROM pg_policies
GROUP BY schemaname, tablename, policyname
HAVING COUNT(*) > 1;

-- Check all triggers on auth.users
SELECT 
    tgname,
    tgenabled,
    tgtype
FROM pg_trigger
WHERE tgrelid = 'auth.users'::regclass
ORDER BY tgname;

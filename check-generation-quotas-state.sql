-- Check if generation_quotas table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'generation_quotas'
) as table_exists;

-- Check if policies exist
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'generation_quotas';

-- Check if trigger exists
SELECT tgname 
FROM pg_trigger 
WHERE tgname = 'on_profile_created_init_quota';

-- Check if function exists
SELECT proname 
FROM pg_proc 
WHERE proname = 'initialize_generation_quota';

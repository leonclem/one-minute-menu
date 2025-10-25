-- Verify generation_quotas table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'generation_quotas'
) as table_exists;

-- Show all columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'generation_quotas'
ORDER BY ordinal_position;

-- Check trigger exists
SELECT tgname 
FROM pg_trigger 
WHERE tgname = 'on_profile_created_init_quota';

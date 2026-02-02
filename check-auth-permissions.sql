-- Check if supabase_auth_admin can see generation_quotas
SET ROLE supabase_auth_admin;
SELECT * FROM pg_tables WHERE tablename = 'generation_quotas';
SELECT * FROM information_schema.tables WHERE table_name = 'generation_quotas';
RESET ROLE;

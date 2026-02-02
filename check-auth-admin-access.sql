-- Check what supabase_auth_admin can see
-- First, check if the role exists and what privileges it has
SELECT 
    r.rolname,
    r.rolsuper,
    r.rolinherit,
    r.rolcreaterole,
    r.rolcreatedb
FROM pg_roles r
WHERE r.rolname = 'supabase_auth_admin';

-- Check table privileges for supabase_auth_admin
SELECT 
    grantee,
    table_schema,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE grantee = 'supabase_auth_admin'
AND table_name IN ('generation_quotas', 'profiles', 'user_packs')
ORDER BY table_name, privilege_type;

-- Check if the table exists in the public schema
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE tablename IN ('generation_quotas', 'profiles', 'user_packs');

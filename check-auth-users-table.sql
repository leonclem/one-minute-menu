-- Check auth.users table for any issues

-- Check if RLS is enabled on auth.users (it shouldn't be)
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Check for any policies on auth.users (there shouldn't be any)
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE schemaname = 'auth' AND tablename = 'users';

-- Check constraints on auth.users
SELECT 
    conname as constraint_name,
    contype as type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'auth.users'::regclass;

-- Check if pgcrypto extension exists (needed for password hashing)
SELECT * FROM pg_extension WHERE extname IN ('pgcrypto', 'uuid-ossp');

-- Try to insert a test user directly into auth.users
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
    test_email TEXT := 'direct-test@example.com';
BEGIN
    BEGIN
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            aud,
            role,
            created_at,
            updated_at
        ) VALUES (
            test_id,
            '00000000-0000-0000-0000-000000000000',
            test_email,
            crypt('test-password', gen_salt('bf')),
            now(),
            'authenticated',
            'authenticated',
            now(),
            now()
        );
        
        RAISE NOTICE 'SUCCESS: User inserted into auth.users';
        
        -- Cleanup
        DELETE FROM profiles WHERE id = test_id;
        DELETE FROM auth.users WHERE id = test_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'FAILED to insert into auth.users: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
    END;
END $$;

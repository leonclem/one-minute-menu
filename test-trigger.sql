-- Test if the trigger works by manually inserting a test user

-- First, check current triggers
SELECT 
    tgname as trigger_name,
    tgenabled as enabled,
    pg_get_triggerdef(oid) as definition
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Test the function directly
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test-' || gen_random_uuid() || '@example.com';
BEGIN
    -- Try to insert a test profile directly
    BEGIN
        INSERT INTO profiles (id, email, role)
        VALUES (test_user_id, test_email, 'user');
        
        RAISE NOTICE 'Direct insert successful! Profile created with id: %', test_user_id;
        
        -- Clean up
        DELETE FROM profiles WHERE id = test_user_id;
        RAISE NOTICE 'Test profile cleaned up';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Error inserting profile: %', SQLERRM;
    END;
END $$;

-- Check if there are any constraint violations
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'profiles'::regclass;

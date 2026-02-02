-- Test the actual user creation flow (simulating what Supabase Auth does)
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test@example.com';
BEGIN
    RAISE NOTICE 'Test user ID: %', test_user_id;
    
    -- Step 1: Create user in auth.users (this is what Supabase Auth does)
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
        test_user_id,
        '00000000-0000-0000-0000-000000000000',
        test_email,
        crypt('password', gen_salt('bf')),
        NOW(),
        'authenticated',
        'authenticated',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Auth user created - trigger should fire now';
    
    -- Step 2: Check if profile was created by trigger
    IF EXISTS (SELECT 1 FROM profiles WHERE id = test_user_id) THEN
        RAISE NOTICE 'Profile created successfully by trigger';
    ELSE
        RAISE NOTICE 'ERROR: Profile NOT created - handle_new_user trigger failed';
    END IF;
    
    -- Step 3: Check if quota was created
    IF EXISTS (SELECT 1 FROM generation_quotas WHERE user_id = test_user_id) THEN
        RAISE NOTICE 'Quota created successfully';
    ELSE
        RAISE NOTICE 'ERROR: Quota NOT created - initialize_generation_quota trigger failed';
    END IF;
    
    -- Step 4: Check if user_pack was created
    IF EXISTS (SELECT 1 FROM user_packs WHERE user_id = test_user_id) THEN
        RAISE NOTICE 'User pack created successfully';
    ELSE
        RAISE NOTICE 'WARNING: User pack NOT created (this is caught by exception handler)';
    END IF;
    
    -- Cleanup
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE 'Cleanup complete';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR during test: % - %', SQLERRM, SQLSTATE;
    -- Try to cleanup anyway
    DELETE FROM auth.users WHERE id = test_user_id;
END $$;

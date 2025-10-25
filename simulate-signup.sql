-- Simulate what happens during user signup

DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test-' || substring(gen_random_uuid()::text, 1, 8) || '@example.com';
BEGIN
    RAISE NOTICE 'Testing signup flow for email: %', test_email;
    
    -- Step 1: Insert into auth.users (this is what Supabase Auth does)
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
            test_user_id,
            '00000000-0000-0000-0000-000000000000',
            test_email,
            crypt('test-password', gen_salt('bf')),
            now(),
            'authenticated',
            'authenticated',
            now(),
            now()
        );
        
        RAISE NOTICE 'User created in auth.users with id: %', test_user_id;
        
        -- Check if profile was created by trigger
        IF EXISTS (SELECT 1 FROM profiles WHERE id = test_user_id) THEN
            RAISE NOTICE 'SUCCESS! Profile was automatically created by trigger';
            
            -- Show the profile
            DECLARE
                profile_role TEXT;
            BEGIN
                SELECT role INTO profile_role FROM profiles WHERE id = test_user_id;
                RAISE NOTICE 'Profile role: %', profile_role;
            END;
        ELSE
            RAISE NOTICE 'FAILED! Profile was NOT created by trigger';
        END IF;
        
        -- Clean up
        DELETE FROM profiles WHERE id = test_user_id;
        DELETE FROM auth.users WHERE id = test_user_id;
        RAISE NOTICE 'Test data cleaned up';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'ERROR during signup simulation: %', SQLERRM;
        -- Try to clean up
        BEGIN
            DELETE FROM profiles WHERE id = test_user_id;
            DELETE FROM auth.users WHERE id = test_user_id;
        EXCEPTION WHEN OTHERS THEN
            NULL;
        END;
    END;
END $$;

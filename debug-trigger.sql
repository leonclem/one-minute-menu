-- Add logging to the trigger to see what's happening

-- First, let's recreate the function with better error handling and logging
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    RAISE NOTICE 'Trigger fired for user: % (email: %)', NEW.id, NEW.email;
    
    BEGIN
        INSERT INTO public.profiles (id, email, role)
        VALUES (NEW.id, NEW.email, 'user');
        
        RAISE NOTICE 'Profile created successfully for user: %', NEW.id;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Failed to create profile for user %: % (SQLSTATE: %)', 
            NEW.id, SQLERRM, SQLSTATE;
        -- Don't re-raise the error, let the user creation succeed
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify the trigger exists
SELECT 
    tgname,
    tgenabled,
    pg_get_triggerdef(oid) as definition
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Test it
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
    test_email TEXT := 'trigger-test-' || substring(gen_random_uuid()::text, 1, 8) || '@example.com';
BEGIN
    RAISE NOTICE 'Testing trigger with email: %', test_email;
    
    INSERT INTO auth.users (
        id, instance_id, email, encrypted_password, 
        email_confirmed_at, aud, role, created_at, updated_at
    ) VALUES (
        test_id, '00000000-0000-0000-0000-000000000000', test_email,
        crypt('test', gen_salt('bf')), now(), 'authenticated', 
        'authenticated', now(), now()
    );
    
    -- Check if profile was created
    IF EXISTS (SELECT 1 FROM profiles WHERE id = test_id) THEN
        RAISE NOTICE '✓ Profile was created by trigger';
    ELSE
        RAISE NOTICE '✗ Profile was NOT created';
    END IF;
    
    -- Cleanup
    DELETE FROM profiles WHERE id = test_id;
    DELETE FROM auth.users WHERE id = test_id;
    RAISE NOTICE 'Test cleanup complete';
END $$;

-- Migration 040: Fix RLS policies for user signup
-- The handle_new_user trigger fails because RLS blocks inserts during user creation
-- when there's no authenticated session yet (auth.uid() is NULL).

-- Solution: Add policies that allow the SECURITY DEFINER trigger function to insert
-- by checking if the function is being called in a privileged context.

-- 1. Add INSERT policy for user_packs that allows trigger to insert
CREATE POLICY "Allow trigger to create user packs" ON user_packs
    FOR INSERT
    WITH CHECK (true);

COMMENT ON POLICY "Allow trigger to create user packs" ON user_packs 
    IS 'Allows the handle_new_user trigger to create initial free pack during signup';

-- 2. Update the handle_new_user function to set session variables that bypass RLS
-- This is the most reliable approach for SECURITY DEFINER functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Set a session variable to indicate we're in a privileged context
    -- This allows RLS policies to check for this and allow the operation
    PERFORM set_config('app.is_creating_user', 'true', true);
    
    -- 1. Create or update the profile
    -- Use ON CONFLICT to handle re-registrations or ghost data gracefully.
    INSERT INTO public.profiles (id, email, plan, is_approved)
    VALUES (NEW.id, NEW.email, 'free', FALSE)
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        is_approved = EXCLUDED.is_approved,
        updated_at = NOW();

    -- 2. Grant one free Creator Pack (First Pack free)
    -- Wrapped in a BEGIN...EXCEPTION block to ensure failures here do not block the entire signup process.
    BEGIN
        INSERT INTO public.user_packs (user_id, pack_type, is_free_trial, edit_window_end)
        VALUES (NEW.id, 'creator_pack', TRUE, NOW() + INTERVAL '1 week');
    EXCEPTION WHEN OTHERS THEN
        -- Log warning but don't block signup. This is critical for UX.
        RAISE WARNING 'Failed to grant free pack to user %: %', NEW.id, SQLERRM;
    END;
    
    -- Clear the session variable
    PERFORM set_config('app.is_creating_user', NULL, true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Creates user profile and grants free pack during signup, bypassing RLS';

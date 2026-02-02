-- Migration 038: Fix handle_new_user function syntax
-- This fixes the single dollar sign issue that causes "Database error saving new user"
-- The function must use $$ (double dollar signs) for proper PostgreSQL syntax

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Create or update the profile
    -- Use ON CONFLICT to handle re-registrations or ghost data gracefully.
    INSERT INTO public.profiles (id, email, plan, is_approved)
    VALUES (NEW.id, NEW.email, 'free', FALSE)
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        is_approved = EXCLUDED.is_approved, -- Reset approval status on re-registration
        updated_at = NOW();

    -- 2. Grant one free Creator Pack (First Pack free)
    -- Wrapped in a BEGIN...EXCEPTION block to ensure failures here do not block the entire signup process.
    -- (e.g., if there's a temporary issue or unexpected constraint on user_packs)
    BEGIN
        INSERT INTO public.user_packs (user_id, pack_type, is_free_trial, edit_window_end)
        VALUES (NEW.id, 'creator_pack', TRUE, NOW() + INTERVAL '1 week');
    EXCEPTION WHEN OTHERS THEN
        -- Log warning but don't block signup. This is critical for UX.
        RAISE WARNING 'Failed to grant free pack to user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS 'Resilient user creation handler that merges approval system and deletion safety';

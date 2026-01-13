-- Migration 029: Add ON DELETE CASCADE and make signup trigger resilient
-- This allows for clean user deletion and robust re-registration

-- 1. Fix profiles table to allow cascading deletes from auth.users
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey,
ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) 
  REFERENCES auth.users(id) 
  ON DELETE CASCADE;

-- 2. Ensure abuse_reports resolved_by reference doesn't block deletion
ALTER TABLE public.abuse_reports
DROP CONSTRAINT IF EXISTS abuse_reports_resolved_by_fkey,
ADD CONSTRAINT abuse_reports_resolved_by_fkey 
  FOREIGN KEY (resolved_by) 
  REFERENCES auth.users(id) 
  ON DELETE SET NULL;

-- 3. Update handle_new_user to be resilient to orphaned data
-- This prevents "Database error saving new user" if ghost data exists
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create or update the profile
    INSERT INTO public.profiles (id, email, plan)
    VALUES (NEW.id, NEW.email, 'free')
    ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        updated_at = NOW();

    -- Grant one free Creator Pack
    BEGIN
        INSERT INTO public.user_packs (user_id, pack_type, is_free_trial, edit_window_end)
        VALUES (NEW.id, 'creator_pack', TRUE, NOW() + INTERVAL '1 week')
        ON CONFLICT DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
        -- Log warning but don't block signup
        RAISE WARNING 'Failed to grant free pack to user %: %', NEW.id, SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON CONSTRAINT profiles_id_fkey ON public.profiles IS 'Allow automatic profile deletion when auth user is removed';

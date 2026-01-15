-- Migration 031: Add approval system fields to profiles
-- Requirements: Pilot Launch Strategy (Approval Gate)

-- 1. Add is_approved and approved_at columns to profiles
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS admin_notified BOOLEAN DEFAULT FALSE;

-- 2. Create index for is_approved lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_approved ON profiles(is_approved);

-- 3. Update handle_new_user to initialize is_approved
-- Existing handle_new_user from migration 027 for reference
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Create the profile
    INSERT INTO public.profiles (id, email, plan, is_approved)
    VALUES (NEW.id, NEW.email, 'free', FALSE);

    -- Grant one free Creator Pack (First Pack free)
    INSERT INTO public.user_packs (user_id, pack_type, is_free_trial, edit_window_end)
    VALUES (NEW.id, 'creator_pack', TRUE, NOW() + INTERVAL '1 week');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Comment for documentation
COMMENT ON COLUMN profiles.is_approved IS 'Whether the user has been approved by an admin for platform access';
COMMENT ON COLUMN profiles.approved_at IS 'When the user was approved';
COMMENT ON COLUMN profiles.admin_notified IS 'Whether an admin notification email has been sent for this registration';

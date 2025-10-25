-- Nuclear option: Drop and recreate everything related to profiles role

-- Step 1: Drop the trigger temporarily
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop the function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Add the role column (if it doesn't exist)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'profiles' AND column_name = 'role'
    ) THEN
        ALTER TABLE profiles ADD COLUMN role VARCHAR(20) DEFAULT 'user';
    END IF;
END $$;

-- Step 4: Add the check constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_role_check'
    ) THEN
        ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
        CHECK (role IN ('user', 'admin'));
    END IF;
END $$;

-- Step 5: Update existing profiles
UPDATE profiles SET role = 'user' WHERE role IS NULL;

-- Step 6: Create index
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Step 7: Recreate the function with role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user');
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Log the error but don't fail
    RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 8: Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 9: Verify
SELECT 'Profiles table structure:' as info;
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

SELECT 'Function created:' as info;
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';

SELECT 'Trigger created:' as info;
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';

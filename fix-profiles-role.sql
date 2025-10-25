-- Fix: Update handle_new_user function to explicitly set role
-- This ensures new users get the 'user' role properly

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (NEW.id, NEW.email, 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also fix any existing users that might not have a role
UPDATE profiles SET role = 'user' WHERE role IS NULL;

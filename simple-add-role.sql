-- Simple, direct approach to add role column

-- First, let's see what we have
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';

-- Add the column directly (no IF NOT EXISTS)
ALTER TABLE profiles ADD COLUMN role VARCHAR(20);

-- Set default value
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'user';

-- Add the constraint
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('user', 'admin'));

-- Update existing rows
UPDATE profiles SET role = 'user' WHERE role IS NULL;

-- Verify it was added
SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';

-- Test inserting a profile manually
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO profiles (id, email, role) 
    VALUES (test_id, 'test@example.com', 'user');
    
    RAISE NOTICE 'Test insert successful!';
    
    -- Clean up test data
    DELETE FROM profiles WHERE id = test_id;
END $$;

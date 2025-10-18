-- Script to assign admin role to a user
-- Usage: Replace 'admin@example.com' with the actual admin user's email

-- Step 1: Verify the user exists
SELECT id, email, role, plan 
FROM profiles 
WHERE email = 'admin@example.com';

-- Step 2: Assign admin role
-- Uncomment the following line after verifying the user exists
-- UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';

-- Step 3: Verify the role was assigned
-- SELECT id, email, role, plan FROM profiles WHERE email = 'admin@example.com';

-- To remove admin role:
-- UPDATE profiles SET role = 'user' WHERE email = 'admin@example.com';

-- To list all admin users:
-- SELECT id, email, role, plan, created_at FROM profiles WHERE role = 'admin';

-- Diagnostic queries to check profiles table

-- Check if role column exists and its constraints
SELECT 
    column_name, 
    data_type, 
    column_default, 
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name = 'role';

-- Check for any profiles with NULL role
SELECT id, email, role, created_at 
FROM profiles 
WHERE role IS NULL;

-- Count profiles by role
SELECT role, COUNT(*) 
FROM profiles 
GROUP BY role;

-- Check the handle_new_user function definition
SELECT prosrc 
FROM pg_proc 
WHERE proname = 'handle_new_user';

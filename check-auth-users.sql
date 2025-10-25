-- Check auth.users table
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there are users without profiles
SELECT u.id, u.email, p.id as profile_id
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Check recent profiles
SELECT id, email, role, created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 5;

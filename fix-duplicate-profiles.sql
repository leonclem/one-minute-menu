-- Check for duplicate profiles
SELECT 
    id,
    COUNT(*) as count
FROM profiles
GROUP BY id
HAVING COUNT(*) > 1;

-- Check all profiles
SELECT 
    id,
    email,
    role,
    plan,
    created_at
FROM profiles
ORDER BY created_at DESC;

-- Delete duplicate profiles, keeping only the most recent one
DELETE FROM profiles p1
USING profiles p2
WHERE p1.id = p2.id
AND p1.created_at < p2.created_at;

-- Verify no duplicates remain
SELECT 
    id,
    COUNT(*) as count
FROM profiles
GROUP BY id
HAVING COUNT(*) > 1;

-- Show final state
SELECT 
    u.id as user_id,
    u.email,
    p.role,
    p.plan,
    p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

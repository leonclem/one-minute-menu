-- Check all users and their associated data

-- All users with their profiles
SELECT 
    u.id as user_id,
    u.email,
    u.created_at as user_created,
    p.id as profile_id,
    p.role,
    p.plan,
    p.created_at as profile_created
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
ORDER BY u.created_at DESC;

-- Count menus per user
SELECT 
    u.email,
    COUNT(m.id) as menu_count
FROM auth.users u
LEFT JOIN menus m ON u.id = m.user_id
GROUP BY u.id, u.email
ORDER BY u.created_at DESC;

-- Show all menus with their owners
SELECT 
    m.id as menu_id,
    m.name as menu_name,
    m.user_id,
    u.email as owner_email,
    m.created_at
FROM menus m
LEFT JOIN auth.users u ON m.user_id = u.id
ORDER BY m.created_at DESC;

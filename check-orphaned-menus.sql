-- Check if there are menus with no valid user

-- All menus (even orphaned ones)
SELECT 
    id,
    name,
    user_id,
    created_at,
    updated_at
FROM menus
ORDER BY created_at DESC;

-- Count total menus
SELECT COUNT(*) as total_menus FROM menus;

-- Check if there are menus with user_ids that don't exist in auth.users
SELECT 
    m.id,
    m.name,
    m.user_id,
    CASE 
        WHEN u.id IS NULL THEN 'ORPHANED (user deleted)'
        ELSE 'OK'
    END as status
FROM menus m
LEFT JOIN auth.users u ON m.user_id = u.id;

-- Get the current logged-in user's ID (from the one user that exists)
SELECT id, email FROM auth.users;

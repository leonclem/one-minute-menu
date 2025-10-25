-- Reassign all orphaned menus to onlyclem@hotmail.com

-- First, get the user ID for onlyclem@hotmail.com
DO $$
DECLARE
    target_user_id UUID;
    orphaned_count INTEGER;
BEGIN
    -- Get the user ID
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'onlyclem@hotmail.com';
    
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User onlyclem@hotmail.com not found!';
    END IF;
    
    RAISE NOTICE 'Target user ID: %', target_user_id;
    
    -- Count orphaned menus (menus with user_ids that don't exist)
    SELECT COUNT(*) INTO orphaned_count
    FROM menus m
    LEFT JOIN auth.users u ON m.user_id = u.id
    WHERE u.id IS NULL;
    
    RAISE NOTICE 'Found % orphaned menus', orphaned_count;
    
    -- Reassign orphaned menus
    UPDATE menus
    SET user_id = target_user_id
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    RAISE NOTICE 'Reassigned % menus to onlyclem@hotmail.com', orphaned_count;
    
    -- Also reassign any other data that might be orphaned
    -- OCR jobs
    UPDATE ocr_jobs
    SET user_id = target_user_id
    WHERE user_id NOT IN (SELECT id FROM auth.users);
    
    -- Image generation jobs (if they exist)
    UPDATE image_generation_jobs
    SET user_id = target_user_id
    WHERE user_id NOT IN (SELECT id FROM auth.users)
    AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'image_generation_jobs');
    
    RAISE NOTICE 'Reassignment complete!';
END $$;

-- Verify the reassignment
SELECT 
    u.email,
    COUNT(m.id) as menu_count
FROM auth.users u
LEFT JOIN menus m ON u.id = m.user_id
GROUP BY u.id, u.email;

-- Show the menus now owned by onlyclem@hotmail.com
SELECT 
    m.id,
    m.name,
    m.status,
    m.created_at,
    u.email as owner
FROM menus m
JOIN auth.users u ON m.user_id = u.id
WHERE u.email = 'onlyclem@hotmail.com'
ORDER BY m.created_at DESC;

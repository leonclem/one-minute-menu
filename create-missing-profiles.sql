-- Create profiles for users that don't have them

INSERT INTO profiles (id, email, role, plan)
SELECT 
    u.id,
    u.email,
    'user' as role,
    'free' as plan
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE p.id IS NULL;

-- Also create generation_quotas for these users
INSERT INTO generation_quotas (user_id, plan, monthly_limit, reset_date)
SELECT 
    u.id,
    'free' as plan,
    10 as monthly_limit,
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' as reset_date
FROM auth.users u
LEFT JOIN generation_quotas gq ON u.id = gq.user_id
WHERE gq.user_id IS NULL;

-- Verify all users now have profiles
SELECT 
    u.id as user_id,
    u.email,
    p.role,
    p.plan,
    gq.monthly_limit,
    gq.current_usage
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN generation_quotas gq ON u.id = gq.user_id
ORDER BY u.created_at DESC;

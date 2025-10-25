-- Check if auth schema and required functions exist

-- Check if pgcrypto extension is installed (required for password hashing)
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';

-- Check auth.users table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_schema = 'auth' AND table_name = 'users'
ORDER BY ordinal_position;

-- Check if there are any auth.users already
SELECT id, email, created_at, email_confirmed_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 5;

-- Check for any failed auth attempts or errors
SELECT 
    id,
    email,
    created_at,
    confirmation_sent_at,
    email_confirmed_at,
    banned_until,
    deleted_at
FROM auth.users
WHERE email_confirmed_at IS NULL
ORDER BY created_at DESC
LIMIT 5;

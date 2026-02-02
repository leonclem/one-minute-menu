-- Migration 041: Grant necessary privileges to supabase_auth_admin
-- The Auth service needs to be able to insert into profiles, user_packs, and generation_quotas
-- when creating new users via the handle_new_user trigger.

-- Grant privileges on profiles table
GRANT SELECT, INSERT, UPDATE ON public.profiles TO supabase_auth_admin;

-- Grant privileges on user_packs table
GRANT SELECT, INSERT ON public.user_packs TO supabase_auth_admin;

-- Grant privileges on generation_quotas table
GRANT SELECT, INSERT, UPDATE ON public.generation_quotas TO supabase_auth_admin;

-- Grant usage on sequences (for auto-incrementing IDs if any)
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO supabase_auth_admin;

-- Ensure future tables also get these privileges
ALTER DEFAULT PRIVILEGES IN SCHEMA public 
    GRANT SELECT, INSERT, UPDATE ON TABLES TO supabase_auth_admin;

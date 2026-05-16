-- ============================================================================
-- Migration 068: Grant DELETE privileges to supabase_auth_admin on tables
--                created after migration 041.
--
-- Background:
--   Migration 041 granted SELECT/INSERT/UPDATE to supabase_auth_admin and set
--   ALTER DEFAULT PRIVILEGES for future tables — but only for SELECT/INSERT/UPDATE,
--   not DELETE. When auth.admin.deleteUser() is called, Supabase's auth service
--   runs as supabase_auth_admin and must be able to DELETE rows that cascade from
--   auth.users. Any table in the cascade chain that supabase_auth_admin cannot
--   DELETE from will cause "Database error deleting user" (unexpected_failure).
--
--   Tables added after migration 041 with ON DELETE CASCADE from auth.users
--   (directly or via menus/profiles) that need DELETE grants:
--     - rate_limits          (056) — FK auth.users ON DELETE CASCADE
--     - uploaded_item_images (061) — FK auth.users ON DELETE CASCADE
--
--   Tables with ON DELETE SET NULL only need UPDATE, which was already granted.
-- ============================================================================

-- Tables with direct or indirect CASCADE from auth.users created after migration 041
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rate_limits TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uploaded_item_images TO supabase_auth_admin;

-- Also ensure the tables created between 041 and 056 have full coverage.
-- These cascade via menus or profiles (which cascade from auth.users):
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_jobs TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cutout_generation_logs TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cutout_render_usage TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.image_generation_jobs TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_feedback TO supabase_auth_admin;

-- Update default privileges to include DELETE for all future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO supabase_auth_admin;

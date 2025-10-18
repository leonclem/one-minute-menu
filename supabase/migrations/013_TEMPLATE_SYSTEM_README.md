# Migration 013: Template System

## Overview

This migration sets up the complete database schema and storage infrastructure for the Figma Menu Template System. It creates three new tables, three storage buckets, and comprehensive RLS policies for secure access control.

## What This Migration Does

### Tables Created

1. **menu_templates**
   - Stores metadata and configuration for all available Figma templates
   - Includes template name, description, author, version, Figma file key
   - Stores template configuration as JSONB (bindings, styling, customization options)
   - Supports filtering by tags, format, premium status

2. **template_renders**
   - Tracks render history and results for user menu renders
   - Stores render data (HTML/CSS), customization settings, and output URLs
   - Supports multiple formats: HTML, PDF, PNG
   - Tracks render status: pending, processing, completed, failed

3. **user_template_preferences**
   - Stores user's preferred template and customization settings per menu
   - One preference record per user-menu combination
   - Persists color and font customizations

### Storage Buckets Created

1. **templates** (public)
   - Stores original Figma files and preview images
   - Public read access for template browsing
   - Admin-only write access
   - 50MB file size limit

2. **templates-compiled** (system)
   - Stores compiled template artifacts (JSON, CSS, assets)
   - Authenticated user read access
   - Admin-only write access
   - 100MB file size limit

3. **rendered-menus** (private)
   - Stores user exports (PDF, PNG, HTML)
   - Private access with signed URLs (24-hour expiration)
   - Users can only access their own renders
   - 100MB file size limit

### RLS Policies

#### Table Policies
- **menu_templates**: Public read for active templates, admin-only write
- **template_renders**: Users can only access their own renders, admins can view all
- **user_template_preferences**: Users can only access their own preferences

#### Storage Policies
- **templates**: Public read, admin write
- **templates-compiled**: Authenticated read, admin write
- **rendered-menus**: User-scoped read/write (folder-based isolation)

## How to Apply This Migration

### Local Development (Supabase CLI)

```bash
# Apply the migration
supabase db reset

# Or apply just this migration
supabase migration up
```

### Production (Supabase Dashboard)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy the contents of `013_template_system.sql`
4. Paste and run the SQL
5. Verify tables and buckets were created successfully

### Verification

After applying the migration, verify the setup:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('menu_templates', 'template_renders', 'user_template_preferences');

-- Check storage buckets exist
SELECT id, name, public 
FROM storage.buckets 
WHERE id IN ('templates', 'templates-compiled', 'rendered-menus');

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('menu_templates', 'template_renders', 'user_template_preferences');

-- Check policies exist
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('menu_templates', 'template_renders', 'user_template_preferences')
ORDER BY tablename, policyname;
```

## Rollback

If you need to rollback this migration:

```bash
# Using the rollback script
psql -h <host> -U <user> -d <database> -f 013_template_system_rollback.sql
```

**Warning**: Rollback will delete all template data, renders, and user preferences. Use with caution in production.

## Dependencies

This migration requires:
- PostgreSQL with `uuid-ossp` extension (for UUID generation)
- Supabase Auth (for `auth.users` table)
- Existing `menus` table (from previous migrations)
- Existing `profiles` table with `role` column (from migration 012)

## Next Steps

After applying this migration:

1. **Seed Initial Templates**: Upload "The View" template and other initial templates
2. **Configure Environment Variables**: Set `FIGMA_API_KEY` and storage bucket names
3. **Test Storage Access**: Verify bucket policies work correctly
4. **Test RLS Policies**: Verify users can only access their own data

## Related Files

- Migration: `013_template_system.sql`
- Rollback: `013_template_system_rollback.sql`
- Design Doc: `.kiro/specs/figma-menu-templates/design.md`
- Requirements: `.kiro/specs/figma-menu-templates/requirements.md`

## Support

For issues or questions about this migration:
1. Check the design document for architecture details
2. Review RLS policies if access issues occur
3. Verify storage bucket configuration in Supabase dashboard
4. Check application logs for detailed error messages

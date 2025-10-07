# Database Recovery Guide

## Immediate Fix for Current Issue

Run this migration to add the missing tables to your production database:

```bash
# Apply the missing tables migration
npx supabase db push --linked
```

Or run this SQL directly in your Supabase SQL Editor:

```sql
-- Run the content of: supabase/migrations/009_add_missing_analytics_tables.sql
```

## Complete Database Recovery (If Database is Wiped)

If your database is completely wiped and you need to restore everything from scratch:

### Option 1: Using Supabase CLI
```bash
# Reset and recreate the entire database
npx supabase db reset --linked

# Or apply the complete recovery script
npx supabase db push --linked
```

### Option 2: Manual SQL Execution
1. Go to your Supabase Dashboard → SQL Editor
2. Run the complete recovery script: `supabase/migrations/000_complete_database_recovery.sql`

## Migration Management Best Practices

### 1. Always Keep Migrations in Sync
```bash
# Check migration status
npx supabase migration list

# Apply pending migrations
npx supabase db push --linked
```

### 2. Create Backups Before Major Changes
```bash
# Create a backup (if using Supabase CLI)
npx supabase db dump --linked > backup-$(date +%Y%m%d).sql
```

### 3. Test Migrations Locally First
```bash
# Test locally
npx supabase db reset
npx supabase db push

# Then apply to production
npx supabase db push --linked
```

## Troubleshooting Common Issues

### Missing Tables Error
- **Symptom**: `Could not find the table 'table_name' in the schema cache`
- **Solution**: Run the appropriate migration or the complete recovery script

### RLS Policy Errors
- **Symptom**: Permission denied errors
- **Solution**: Check that RLS policies are properly created in migrations

### Migration Out of Sync
- **Symptom**: Local works but production doesn't
- **Solution**: Compare migration history and apply missing migrations

## Prevention Strategies

1. **Always use migrations** for schema changes
2. **Test migrations locally** before applying to production
3. **Keep migration files in version control**
4. **Document schema changes** in migration comments
5. **Regular backups** of production data

## Emergency Contacts

If you need help with database recovery:
1. Check Supabase Dashboard → Database → Migrations
2. Review migration history and status
3. Use the complete recovery script as a last resort
4. Contact Supabase support if data recovery is needed

## Files Reference

- `scripts/complete_database_recovery.sql` - Complete database rebuild (emergency use only)
- `supabase/migrations/009_add_missing_analytics_tables.sql` - Fix current missing tables
- `supabase/migrations/008_add_platform_analytics_table.sql` - Fix platform analytics table
- `supabase/migrations/001_initial_schema.sql` - Original schema definition

## Important Notes

- The complete recovery script is for **emergency use only**
- Normal operations should use the numbered migration files
- The recovery script should **not** be run as a regular migration
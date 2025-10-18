# Deployment Summary - Admin Access Control

## What You Need to Run in Production

### Single SQL Command (Copy & Paste)

Open your Supabase SQL Editor and run this:

```sql
-- Add role column to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for efficient role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add documentation
COMMENT ON COLUMN profiles.role IS 'User role: user (default) or admin (for dashboard access)';
```

That's it! This is safe to run multiple times (idempotent).

### Then Assign Admin Roles

```sql
-- Replace with your actual admin email
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'your-admin@example.com';
```

### Verify It Worked

```sql
-- Should show your admin user(s)
SELECT email, role FROM profiles WHERE role = 'admin';
```

## What Changed in the Code

These files were modified and will be deployed:
- ✅ `src/lib/auth-utils.ts` - New utility functions
- ✅ `src/app/admin/*/page.tsx` - Protected admin pages
- ✅ `src/app/dashboard/page.tsx` - Conditional admin links
- ✅ `src/components/QuotaUsageDashboard.tsx` - Conditional link
- ✅ `src/types/index.ts` - Added role field
- ✅ `src/lib/database.ts` - Include role in queries

## Testing After Deployment

### As Admin User:
1. Login → Should see "Analytics" link in header ✅
2. Click Analytics → Should access `/admin/analytics` ✅
3. Visit `/admin/extraction-metrics` → Should work ✅
4. Visit `/admin/extraction-feedback` → Should work ✅

### As Regular User:
1. Login → Should NOT see "Analytics" link ✅
2. Try `/admin/analytics` → Should redirect to `/dashboard` ✅
3. Dashboard works normally ✅

## Important Notes

### ✅ What We Fixed
- Removed the problematic RLS policy that caused infinite recursion
- Admin access is now handled at the application level (more secure)
- Migration is idempotent (safe to run multiple times)

### ❌ What NOT to Do
- Don't create RLS policies that query the profiles table
- Don't try to add the "Admins can view all profiles" policy
- Don't skip the verification step

## Files for Reference

- **Migration**: `supabase/migrations/012_add_user_roles_PRODUCTION.sql`
- **Quick Reference**: `PRODUCTION_SQL_QUICK_REFERENCE.md`
- **Full Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md`
- **Troubleshooting**: `docs/ADMIN_ROLES.md`

## Timeline

1. **Run SQL** (2 minutes)
2. **Assign admin roles** (1 minute)
3. **Deploy code** (5-10 minutes, depending on platform)
4. **Test** (5 minutes)

**Total: ~15 minutes**

## Support

If you see "infinite recursion" error:
```sql
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
```

For other issues, see `docs/ADMIN_ROLES.md` troubleshooting section.

---

**Ready to deploy?** Just run the SQL above, assign admin roles, and deploy your code! 🚀

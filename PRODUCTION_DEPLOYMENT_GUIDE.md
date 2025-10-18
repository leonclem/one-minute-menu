# Production Deployment Guide - Admin Access Control

## Overview
This guide covers deploying the admin access control feature to production.

## Pre-Deployment Checklist

- [ ] All code changes committed to repository
- [ ] Local testing completed successfully
- [ ] Admin email addresses identified
- [ ] Backup of production database taken
- [ ] Supabase production project access confirmed

## Step 1: Apply Database Migration

### Option A: Using Supabase Dashboard (Recommended)

1. **Login to Supabase Dashboard**
   - Go to https://app.supabase.com
   - Select your production project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Copy the contents of `supabase/migrations/012_add_user_roles_PRODUCTION.sql`
   - Paste into the SQL Editor
   - Click "Run" or press Ctrl+Enter

4. **Verify Success**
   - You should see "Success. No rows returned"
   - Run this verification query:
   ```sql
   SELECT column_name, data_type, column_default 
   FROM information_schema.columns 
   WHERE table_name = 'profiles' AND column_name = 'role';
   ```
   - Expected output: Shows the `role` column with default 'user'

### Option B: Using Supabase CLI

```bash
# Make sure you're connected to production
supabase link --project-ref your-production-project-ref

# Push the migration
supabase db push

# Verify
supabase db diff
```

## Step 2: Assign Admin Roles

After the migration is applied, assign admin role to your admin users:

```sql
-- Replace with your actual admin email(s)
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@yourdomain.com';

-- For multiple admins
UPDATE profiles 
SET role = 'admin' 
WHERE email IN (
  'admin1@yourdomain.com',
  'admin2@yourdomain.com',
  'admin3@yourdomain.com'
);
```

### Verify Admin Assignment

```sql
-- List all admin users
SELECT id, email, role, plan, created_at 
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at;
```

## Step 3: Deploy Application Code

### If using Vercel:

```bash
# Commit all changes
git add .
git commit -m "feat: Add admin role-based access control"

# Push to main/production branch
git push origin main

# Vercel will auto-deploy
```

### If using other platforms:

Follow your standard deployment process. The code changes are:
- `src/lib/auth-utils.ts` (new file)
- `src/app/admin/*/page.tsx` (updated)
- `src/app/dashboard/page.tsx` (updated)
- `src/components/QuotaUsageDashboard.tsx` (updated)
- `src/types/index.ts` (updated)
- `src/lib/database.ts` (updated)

## Step 4: Post-Deployment Verification

### Test Admin Access

1. **Login as Admin User**
   - Navigate to your production URL
   - Login with an admin email
   - Go to `/dashboard`
   - Verify "Analytics" link appears in header
   - Verify "View details →" link appears in AI Image Generation card
   - Click "Analytics" link
   - Should navigate to `/admin/analytics` successfully

2. **Test Admin Dashboards**
   - Visit `/admin/extraction-metrics` - Should work
   - Visit `/admin/analytics` - Should work
   - Visit `/admin/extraction-feedback` - Should work

### Test Regular User Access

1. **Login as Regular User**
   - Login with a non-admin email
   - Go to `/dashboard`
   - Verify "Analytics" link is NOT visible
   - Verify "View details →" link is NOT visible
   - Try to manually navigate to `/admin/analytics`
   - Should redirect to `/dashboard`

2. **Test All Admin Pages**
   - Try `/admin/extraction-metrics` - Should redirect
   - Try `/admin/analytics` - Should redirect
   - Try `/admin/extraction-feedback` - Should redirect

### Test Unauthenticated Access

1. **Logout**
2. **Try to access admin pages**
   - Navigate to `/admin/analytics`
   - Should redirect to `/auth/signin`

## Step 5: Monitor for Issues

### Check Application Logs

Look for any errors related to:
- Database queries on profiles table
- Authentication errors
- Redirect loops

### Check Supabase Logs

1. Go to Supabase Dashboard
2. Click "Logs" in left sidebar
3. Filter for errors
4. Look for any RLS policy errors (there shouldn't be any)

## Rollback Plan

If you encounter issues:

### Rollback Database Changes

```sql
-- Remove the role column (if needed)
ALTER TABLE profiles DROP COLUMN IF EXISTS role;

-- Drop the index
DROP INDEX IF EXISTS idx_profiles_role;
```

### Rollback Application Code

```bash
# Revert to previous commit
git revert HEAD

# Push to trigger redeployment
git push origin main
```

## Common Issues and Solutions

### Issue: "Infinite recursion detected"

**Cause**: The problematic RLS policy was created  
**Solution**: Run this immediately:
```sql
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
```

### Issue: Admin users can't access dashboards

**Cause**: Role not assigned correctly  
**Solution**: 
```sql
-- Check current role
SELECT email, role FROM profiles WHERE email = 'admin@example.com';

-- Assign admin role
UPDATE profiles SET role = 'admin' WHERE email = 'admin@example.com';
```

### Issue: Regular users see admin links

**Cause**: Code deployment issue  
**Solution**: 
- Verify latest code is deployed
- Clear browser cache
- Check that `getCurrentUser()` is being called correctly

## Security Checklist

After deployment, verify:

- [ ] Admin dashboards are protected (redirect non-admins)
- [ ] Admin links are hidden for regular users
- [ ] Unauthenticated users are redirected to signin
- [ ] No RLS policy errors in logs
- [ ] Admin users can access all admin features
- [ ] Regular users have normal access to their features

## Documentation

After successful deployment, update your internal docs with:
- List of admin users
- Process for adding new admins
- Link to this deployment guide
- Contact for admin access requests

## Support

If you encounter issues:
1. Check `docs/ADMIN_ROLES.md` for troubleshooting
2. Check `docs/ADMIN_RLS_POLICY_FIX.md` for RLS issues
3. Review application and database logs
4. Test in staging environment first if available

## Summary

**What was deployed:**
- ✅ Database: Added `role` column to profiles table
- ✅ Database: Created index for role lookups
- ✅ Application: Added admin access control utilities
- ✅ Application: Protected admin dashboard pages
- ✅ Application: Conditional UI rendering for admin links

**What to do after deployment:**
1. Assign admin roles to appropriate users
2. Test admin and regular user access
3. Monitor logs for any issues
4. Document admin users internally

**Estimated deployment time:** 10-15 minutes

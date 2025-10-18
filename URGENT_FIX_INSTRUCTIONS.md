# 🚨 URGENT FIX: Infinite Recursion Error

## Problem
You're seeing this error:
```
DatabaseError: Failed to get user profile: infinite recursion detected in policy for relation "profiles"
```

## Quick Fix (Do This Now)

### Step 1: Open Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar

### Step 2: Run This Command
Copy and paste this into the SQL Editor and click "Run":

```sql
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
```

### Step 3: Verify
Run this to confirm the policy is gone:

```sql
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
```

You should see only 3 policies:
- Users can insert own profile
- Users can update own profile
- Users can view own profile

### Step 4: Clean Next.js Cache and Restart

```powershell
# Stop the server (Ctrl+C)

# Delete the .next cache folder
Remove-Item -Recurse -Force .next

# Restart the dev server
npm run dev
```

**Note**: If you get an error about `.next` folder, see `FIX_NEXTJS_CACHE.md` for detailed instructions.

## What Happened?

The migration created an RLS policy that caused infinite recursion. The policy tried to check if a user is an admin by querying the profiles table, which triggered the same policy again, creating an infinite loop.

## Why This Fix Works

- **Removed**: The problematic RLS policy
- **Kept**: The original 3 RLS policies (which work fine)
- **Admin Access**: Now handled at the application level (which is more secure anyway)

## Verification

After the fix, try accessing your dashboard. It should work normally.

If you still see errors:
1. Clear your browser cache
2. Restart your dev server
3. Check the Supabase logs for other issues

## Prevention

The migration file has been updated to prevent this issue. If you need to re-run migrations:
- Use the updated `supabase/migrations/012_add_user_roles.sql`
- It no longer creates the problematic policy

## Need Help?

See these files for more details:
- `docs/ADMIN_RLS_POLICY_FIX.md` - Detailed explanation
- `scripts/fix-infinite-recursion.sql` - SQL fix script
- `docs/ADMIN_ROLES.md` - Updated admin guide

## Summary

✅ **Do**: Run `DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;`  
✅ **Do**: Restart your dev server  
❌ **Don't**: Try to fix the policy - just remove it  
❌ **Don't**: Create new RLS policies that query the same table

# Production SQL - Quick Reference

## 1. Apply Migration (Run Once)

```sql
-- Add role column to profiles table
ALTER TABLE profiles 
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Create index for efficient role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Add documentation
COMMENT ON COLUMN profiles.role IS 'User role: user (default) or admin (for dashboard access)';
```

## 2. Assign Admin Roles

```sql
-- Single admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@yourdomain.com';

-- Multiple admins
UPDATE profiles 
SET role = 'admin' 
WHERE email IN (
  'admin1@yourdomain.com',
  'admin2@yourdomain.com'
);
```

## 3. Verification Queries

```sql
-- Verify migration applied
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'role';

-- List all admin users
SELECT id, email, role, plan, created_at 
FROM profiles 
WHERE role = 'admin'
ORDER BY created_at;

-- Count users by role
SELECT role, COUNT(*) as count
FROM profiles
GROUP BY role;

-- Check specific user's role
SELECT email, role FROM profiles WHERE email = 'user@example.com';
```

## 4. Management Queries

```sql
-- Add admin role
UPDATE profiles SET role = 'admin' WHERE email = 'user@example.com';

-- Remove admin role
UPDATE profiles SET role = 'user' WHERE email = 'user@example.com';

-- List all policies on profiles table (should be only 3)
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'profiles'
ORDER BY policyname;
```

## 5. Emergency Fixes

```sql
-- If you see "infinite recursion" error, run this immediately:
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;

-- Verify only 3 policies remain:
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
-- Expected: Users can insert own profile, Users can update own profile, Users can view own profile
```

## 6. Rollback (If Needed)

```sql
-- Remove role column
ALTER TABLE profiles DROP COLUMN IF EXISTS role;

-- Drop index
DROP INDEX IF EXISTS idx_profiles_role;
```

---

## Copy-Paste Ready Commands

### For Initial Setup:
1. Copy the migration SQL from section 1
2. Run in Supabase SQL Editor
3. Copy admin assignment SQL from section 2
4. Update with your admin emails
5. Run verification queries from section 3

### Order of Operations:
1. ✅ Run migration (section 1)
2. ✅ Assign admin roles (section 2)
3. ✅ Verify (section 3)
4. ✅ Deploy application code
5. ✅ Test access

---

**File Location**: `supabase/migrations/012_add_user_roles_PRODUCTION.sql`  
**Full Guide**: `PRODUCTION_DEPLOYMENT_GUIDE.md`

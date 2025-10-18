# Admin RLS Policy Fix - Infinite Recursion Issue

## Problem

The initial migration created an RLS policy that caused infinite recursion:

```sql
CREATE POLICY "Admins can view all profiles" ON profiles 
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Why it fails**: When checking if a user can view a profile, the policy queries the profiles table to check if the user is an admin. This triggers the same policy again, creating an infinite loop.

## Solution

**Remove the problematic policy**. Admin access to view all profiles should be handled at the application level using the service role key, not through RLS policies.

### Immediate Fix

Run this in your Supabase SQL Editor:

```sql
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
```

Or use the provided script:
```bash
# Run the fix script
scripts/fix-infinite-recursion.sql
```

## Why This Approach Works

### RLS Policies (For Regular Users)
The existing RLS policies are sufficient for regular users:
- `"Users can view own profile"` - Users can see their own profile
- `"Users can update own profile"` - Users can update their own profile
- `"Users can insert own profile"` - Users can create their own profile

### Application-Level Access (For Admins)
Admin access is handled differently:
1. **Server-side checks**: Use `getCurrentUser()` to check role
2. **Service role key**: Admin operations use Supabase service role (bypasses RLS)
3. **No RLS needed**: Admins don't need special RLS policies

## How Admin Access Works

### For Admin Dashboard Pages
```typescript
// Admin pages use requireAdmin() which redirects non-admins
await requireAdmin()
```

### For Viewing Other Profiles (If Needed)
If admins need to view other user profiles, use the service role client:

```typescript
import { createClient } from '@supabase/supabase-js'

// Service role client bypasses RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Service role key
  { auth: { persistSession: false } }
)

// This works because service role bypasses RLS
const { data: allProfiles } = await supabaseAdmin
  .from('profiles')
  .select('*')
```

## Updated Migration

The corrected migration (`012_add_user_roles.sql`) now:
- ✅ Adds the `role` column
- ✅ Creates the index
- ✅ Adds documentation
- ❌ Does NOT create the problematic RLS policy

## Verification

After applying the fix, verify:

```sql
-- Should show only 3 policies (the original ones)
SELECT policyname FROM pg_policies WHERE tablename = 'profiles';
```

Expected output:
- Users can insert own profile
- Users can update own profile
- Users can view own profile

## Key Takeaway

**RLS policies should not query the same table they're protecting** - this creates infinite recursion. For admin access, use application-level checks and service role keys instead.

## Related Files

- `supabase/migrations/012_add_user_roles.sql` - Corrected migration
- `supabase/migrations/012_fix_rls_policy.sql` - Fix script
- `scripts/fix-infinite-recursion.sql` - Quick fix for immediate use

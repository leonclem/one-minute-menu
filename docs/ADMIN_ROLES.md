# Admin Role Management

This document describes how to manage admin roles for accessing admin dashboards.

## Overview

The system supports two user roles:
- `user` (default): Regular users with access to their own menus and data
- `admin`: Administrators with access to platform-wide analytics and metrics

## Admin Dashboards

Admin users have access to the following dashboards:

1. **Extraction Metrics Dashboard** (`/admin/extraction-metrics`)
   - View extraction performance metrics
   - Monitor token usage and costs
   - Track extraction quality and confidence scores
   - View cost alerts and spending trends

2. **Platform Analytics Dashboard** (`/admin/analytics`)
   - View platform-wide usage metrics
   - Monitor AI image generation statistics
   - Track user activity and engagement
   - Review aggregated analytics data

3. **Extraction Feedback Dashboard** (`/admin/extraction-feedback`)
   - Review user feedback on extraction quality
   - View correction details and system errors
   - Analyze feedback patterns for prompt improvement
   - Monitor user satisfaction with extraction results

## Assigning Admin Role

To assign admin role to a user, you need to update the `profiles` table in the database.

### Using Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run the following query:

```sql
-- Replace 'admin@example.com' with the actual admin user's email
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'admin@example.com';
```

### Verifying Admin Role

To verify that a user has admin role:

```sql
SELECT id, email, role 
FROM profiles 
WHERE email = 'admin@example.com';
```

### Removing Admin Role

To remove admin role from a user:

```sql
UPDATE profiles 
SET role = 'user' 
WHERE email = 'admin@example.com';
```

## Access Control

### How It Works

1. When a user tries to access an admin dashboard, the system checks their role in the `profiles` table
2. If the user is not authenticated, they are redirected to `/auth/signin`
3. If the user is authenticated but not an admin, they are redirected to `/dashboard`
4. Only users with `role = 'admin'` can access admin dashboards

### Implementation Details

The access control is implemented using the `requireAdmin()` function from `src/lib/auth-utils.ts`:

```typescript
import { requireAdmin } from '@/lib/auth-utils'

export default async function AdminPage() {
  // This will redirect non-admin users to /dashboard
  await requireAdmin()
  
  // Admin-only code here
}
```

## Security Considerations

1. **Database-Level Security**: The role is stored in the `profiles` table
2. **Server-Side Checks**: All admin checks are performed server-side to prevent client-side bypasses
3. **Minimal Privilege**: Only assign admin role to trusted users who need platform-wide access
4. **Audit Trail**: Consider logging admin access for security auditing
5. **RLS Policies**: Regular RLS policies apply. Admin access to view all profiles (if needed) should use service role key, not RLS policies

## Migration

The admin role feature was added in migration `012_add_user_roles.sql`. To apply this migration:

1. Ensure you're on the latest migration version
2. Run the migration using Supabase CLI or SQL Editor
3. The migration will:
   - Add the `role` column to the `profiles` table
   - Set default role to `'user'` for all existing users
   - Create an index for efficient role lookups
   - Add RLS policies for admin access

## Troubleshooting

### Infinite Recursion Error

If you see "infinite recursion detected in policy for relation 'profiles'":

1. **Immediate Fix**: Run this SQL command:
   ```sql
   DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
   ```

2. **Explanation**: The problematic policy tried to check admin status by querying the profiles table, creating infinite recursion

3. **Solution**: Admin access is handled at the application level, not via RLS policies

See [ADMIN_RLS_POLICY_FIX.md](./ADMIN_RLS_POLICY_FIX.md) for details.

### User Can't Access Admin Dashboard

1. Verify the user's role in the database:
   ```sql
   SELECT email, role FROM profiles WHERE email = 'user@example.com';
   ```

2. Ensure the migration has been applied:
   ```sql
   SELECT * FROM profiles LIMIT 1;
   -- Should show 'role' column
   ```

3. Check that the user is properly authenticated

### Admin Dashboard Shows Error

1. Check server logs for authentication errors
2. Verify Supabase connection is working
3. Ensure only the original 3 RLS policies exist (no "Admins can view all profiles" policy)

## Future Enhancements

Potential improvements for the admin role system:

- Add more granular permissions (e.g., `metrics_viewer`, `analytics_admin`)
- Create an admin UI for managing user roles
- Add audit logging for admin actions
- Implement role-based API access controls
- Add email notifications when admin role is assigned/removed

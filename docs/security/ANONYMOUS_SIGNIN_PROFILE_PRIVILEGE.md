# Anonymous sign-in and profile privilege

**Date:** 2026-09-22
**Status:** Open. Anonymous sign-ins stay enabled. Do this when there is time for a migration and a short regression pass.
**Severity:** Privilege escalation for any signed-in user. Anonymous Studio guests make it easy to reach, because they get an authenticated session with no email.

---

## What the Supabase warning means

Turning on **Authentication → Sign In / Providers → Allow anonymous sign-ins** shows:

> Anonymous users will use the authenticated role when signing in. As a result, anonymous users will be subjected to RLS policies that apply to the public and authenticated roles.

That warning is expected. It is not a reason to turn the provider off.

`signInAnonymously()` creates a real `auth.users` row. The JWT role is `authenticated`, same as a magic-link user. The guest is distinguished by `is_anonymous` on the JWT and by `profiles.is_guest`. Row-level security that only checks `auth.uid() = user_id` still limits a guest to their own rows. They do not inherit another user's dishes, menus, or credits.

Shared reads that already apply to every signed-in user also apply to guests: active lighting and background styles, published menus, and feature flags. `studio_guest_sessions` has RLS and no client policies, so claim tokens stay server-side.

---

## The problem

`profiles` allows a user to update their own row with no column guard.

From `supabase/migrations/001_initial_schema.sql`:

```sql
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);
```

`PATCH /api/profile` only forwards safe fields (`username`, venue info, onboarding, and similar). That check is in the Next.js route. The browser Supabase client can call PostgREST directly with the same user JWT and skip the route. A session can set its own `role` to `admin`, and can also change `is_approved`, `is_guest`, `plan`, Stripe fields, and `last_login_at`.

Admin policies then trust `profiles.role = 'admin'`. After that self-update, the same session can pass those policies. Examples: lighting and background style writes (`073_studio_reference_libraries.sql`), prompt presets, purchase audit, feature-flag management, and cutout logs.

This hole exists for every authenticated user, including magic-link accounts. Anonymous sign-in removes the email step, so a throwaway session is enough.

Studio guest API limits still hold after `is_guest` is cleared, because `requireStudioApi` also treats `user.is_anonymous` as a guest. The admin-role change does not. It is a database privilege change, not a Studio UI bypass.

---

## What is not the problem

- Other users' `studio_dishes`, `studio_images`, menus, and credit balances. Those policies compare `auth.uid()` to the row owner.
- Studio credit RPCs. `studio_apply_credit_delta` is granted to `service_role` only.
- Guest generation spend. Generation routes use `requireStudioApi()` with the default `guest: 'deny'`. A guest session cannot call those routes even if it inserts extra dish rows directly.

---

## Fix

Add a migration (next number after `090`, so `091_protect_profile_privileged_columns.sql` unless a later migration lands first).

Use a `BEFORE UPDATE` trigger on `public.profiles`. Leave the existing "own row" policy in place. The trigger rejects changes to privileged columns when the session is `authenticated` or `anon`.

Allow the change when the session role is one of:

- `service_role` (Stripe webhooks, admin approve, admin plan changes, `last_login_at` stamp in `src/app/auth/callback/route.ts`)
- `supabase_auth_admin` (the `handle_new_user` trigger, which upserts the profile)
- the migration/table owner roles Supabase uses for those triggers (`postgres`, `supabase_admin`), confirmed against the live project before shipping

The trigger function should be `SECURITY INVOKER` so `current_user` is the session role. Compare each protected column with `IS DISTINCT FROM` so a no-op update of the same value still succeeds.

### Columns the client must not change

| Column | Who writes it today |
|---|---|
| `role` | SQL / service role only. See `docs/ADMIN_ROLES.md`. |
| `is_approved`, `approved_at` | Service role in the admin approve route and auth callback. |
| `admin_notified` | Service role in the auth callback. |
| `is_guest` | `handle_new_user` only. |
| `plan`, `plan_limits` | Service role (admin plan route, Stripe). |
| `stripe_customer_id`, `stripe_subscription_id`, `subscription_status`, `subscription_period_end` | Service role (Stripe). |
| `email` | `handle_new_user`. |
| `last_login_at` | Service role in the auth callback. Protect this too, so a guest cannot stamp a verified-login signal. |

### Columns the client must still be able to change

These already go through the user session. The trigger must not block them.

- `username`, `location`, `restaurant_name`, `establishment_type`, `primary_cuisine`, `default_venue_info`
- `onboarding_completed`, `first_template_visit_at`
- `studio_first_run_dismissed` (`PATCH /api/studio/onboarding`, user client)
- `billing_currency`, `billing_currency_updated_at` (`setAccountBillingCurrency` in `src/lib/billing-currency-service.ts`, user client)

Do not switch those call sites to the service role as part of this fix. The trigger is enough, and a service-role update from a user-controlled route would widen the hole.

### Checks before applying

1. In the production SQL editor, confirm which role `handle_new_user` runs as (`SELECT proowner::regrole FROM pg_proc WHERE proname = 'handle_new_user'`). Include that role in the allow-list.
2. Apply with `npx supabase db push` or by running the migration SQL. Do not `supabase db reset`.
3. Smoke, as a normal signed-in user (not only a guest):
   - Save a profile field and the Studio first-run dismissal.
   - Save billing currency.
   - Direct `update profiles set role = 'admin'` for `auth.uid()` fails.
   - Direct `update profiles set is_approved = true` fails.
4. Smoke, as admin / service role:
   - Approve a user.
   - Change a plan.
   - Magic-link callback still sets `last_login_at`.
5. Guest path still opens `/studio` and still cannot call a generation route.

---

## Follow-up, lower priority

Guest dish, source, and crop caps live in `src/lib/studio/guest/guest-caps.ts` and run only on the Next.js routes. PostgREST inserts of `studio_dishes` / `studio_images` for the guest's own `user_id` skip those caps.

That does not spend generation credits. It can add storage and rows. Leave it unless guest storage abuse shows up. If it does, a narrow insert trigger for `profiles.is_guest` users is the place to enforce the one-dish and one-source limits. Do not try to copy the crop rules into RLS.

Anonymous sign-up volume is a separate dashboard setting. Supabase rate-limits anonymous sign-ins (30 requests per hour per IP by default) and recommends CAPTCHA if that endpoint is abused. Expired guests are listed by `studio_list_expired_guest_user_ids` for cleanup. No code change is required for that unless the rate limit is hit.

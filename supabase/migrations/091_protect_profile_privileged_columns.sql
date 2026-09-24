-- Stop signed-in users from changing privileged profile columns or inserting
-- their own profile row. The existing "own row" policies stay in place.
-- Safe to run more than once. Does not reset, truncate, or delete data.
--
-- Allow-list is the session role (SECURITY INVOKER / current_user):
--   service_role, supabase_auth_admin, postgres, supabase_admin
-- Local handle_new_user is owned by postgres (confirmed 2026-09-23).
-- Do not add authenticator: it sits under every API call.

CREATE OR REPLACE FUNCTION public.profile_privileged_write_allowed()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT current_user IN (
    'service_role',
    'supabase_auth_admin',
    'postgres',
    'supabase_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF public.profile_privileged_write_allowed() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'profile privileged column change denied'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role
    OR NEW.is_approved IS DISTINCT FROM OLD.is_approved
    OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
    OR NEW.admin_notified IS DISTINCT FROM OLD.admin_notified
    OR NEW.is_guest IS DISTINCT FROM OLD.is_guest
    OR NEW.plan IS DISTINCT FROM OLD.plan
    OR NEW.plan_limits IS DISTINCT FROM OLD.plan_limits
    OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
    OR NEW.stripe_subscription_id IS DISTINCT FROM OLD.stripe_subscription_id
    OR NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
    OR NEW.subscription_period_end IS DISTINCT FROM OLD.subscription_period_end
    OR NEW.email IS DISTINCT FROM OLD.email
    OR NEW.last_login_at IS DISTINCT FROM OLD.last_login_at
  THEN
    RAISE EXCEPTION 'profile privileged column change denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.protect_profile_privileged_columns() IS
  'Rejects client inserts and client changes to privileged profiles columns. Service role and handle_new_user owner may still write them.';

REVOKE ALL ON FUNCTION public.profile_privileged_write_allowed() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_privileged_write_allowed()
  TO anon, authenticated, service_role, supabase_auth_admin, supabase_admin;

REVOKE ALL ON FUNCTION public.protect_profile_privileged_columns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.protect_profile_privileged_columns()
  TO anon, authenticated, service_role, supabase_auth_admin, supabase_admin;

DROP TRIGGER IF EXISTS profiles_protect_privileged_update ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

DROP TRIGGER IF EXISTS profiles_protect_privileged_insert ON public.profiles;
CREATE TRIGGER profiles_protect_privileged_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_privileged_columns();

-- Guest Studio first cut: temporary users, claim-on-signup, no starter credits.

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.profiles.is_guest IS
    'True for anonymous Studio visitors until their work is claimed onto a verified account.';

CREATE TABLE IF NOT EXISTS public.studio_guest_sessions (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    claim_token UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    magic_link_sent_at TIMESTAMPTZ,
    pending_action JSONB,
    claimed_at TIMESTAMPTZ,
    claimed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_guest_sessions_unclaimed_seen
    ON public.studio_guest_sessions (last_seen_at)
    WHERE claimed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_studio_guest_sessions_claim_token
    ON public.studio_guest_sessions (claim_token)
    WHERE claimed_at IS NULL;

COMMENT ON TABLE public.studio_guest_sessions IS
    'Tracks anonymous Studio visitors for claim-on-signup and TTL cleanup.';

ALTER TABLE public.studio_guest_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_email TEXT;
    v_is_guest BOOLEAN;
BEGIN
    PERFORM set_config('app.is_creating_user', 'true', true);

    v_is_guest := COALESCE(NEW.is_anonymous, FALSE) OR NEW.email IS NULL;
    v_email := COALESCE(NEW.email, 'guest-' || NEW.id::text || '@guest.gridmenu.invalid');

    INSERT INTO public.profiles (id, email, plan, is_approved, is_guest)
    VALUES (NEW.id, v_email, 'free', FALSE, v_is_guest)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        is_approved = EXCLUDED.is_approved,
        is_guest = public.profiles.is_guest OR EXCLUDED.is_guest,
        updated_at = NOW();

    IF v_is_guest THEN
        INSERT INTO public.studio_guest_sessions (user_id)
        VALUES (NEW.id)
        ON CONFLICT (user_id) DO NOTHING;
    ELSE
        BEGIN
            INSERT INTO public.user_packs (user_id, pack_type, is_free_trial, edit_window_end)
            VALUES (NEW.id, 'creator_pack', TRUE, NOW() + INTERVAL '1 week');
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to grant free pack to user %: %', NEW.id, SQLERRM;
        END;

        BEGIN
            PERFORM studio_ensure_starter_credits(NEW.id);
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Failed to grant starter Studio credits to user %: %', NEW.id, SQLERRM;
        END;
    END IF;

    PERFORM set_config('app.is_creating_user', NULL, true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS
    'Creates a profile. Verified signups get a free menu pack and 10 Studio credits. Anonymous guests do not.';

CREATE OR REPLACE FUNCTION public.studio_claim_guest_work(
    p_claim_token UUID,
    p_verified_user_id UUID
)
RETURNS TABLE (
    guest_user_id UUID,
    claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_guest_id UUID;
BEGIN
    SELECT s.user_id INTO v_guest_id
    FROM public.studio_guest_sessions s
    WHERE s.claim_token = p_claim_token
      AND s.claimed_at IS NULL
    FOR UPDATE;

    IF v_guest_id IS NULL THEN
        RETURN QUERY SELECT NULL::UUID, FALSE;
        RETURN;
    END IF;

    IF v_guest_id = p_verified_user_id THEN
        UPDATE public.studio_guest_sessions
        SET claimed_at = NOW(),
            claimed_by_user_id = p_verified_user_id
        WHERE user_id = v_guest_id;

        RETURN QUERY SELECT v_guest_id, TRUE;
        RETURN;
    END IF;

    UPDATE public.studio_dishes
    SET user_id = p_verified_user_id,
        updated_at = NOW()
    WHERE user_id = v_guest_id;

    UPDATE public.studio_images
    SET user_id = p_verified_user_id
    WHERE user_id = v_guest_id;

    UPDATE public.studio_image_spatial_inventories
    SET user_id = p_verified_user_id
    WHERE user_id = v_guest_id;

    UPDATE public.studio_guest_sessions
    SET claimed_at = NOW(),
        claimed_by_user_id = p_verified_user_id
    WHERE user_id = v_guest_id;

    RETURN QUERY SELECT v_guest_id, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.studio_claim_guest_work(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_claim_guest_work(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.studio_list_expired_guest_user_ids(
    p_idle_hours INTEGER DEFAULT 48,
    p_magic_link_grace_days INTEGER DEFAULT 7
)
RETURNS TABLE (user_id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT s.user_id
    FROM public.studio_guest_sessions s
    JOIN public.profiles p ON p.id = s.user_id
    WHERE s.claimed_at IS NULL
      AND p.is_guest = TRUE
      AND s.last_seen_at < NOW() - (p_idle_hours || ' hours')::INTERVAL
      AND (
          s.magic_link_sent_at IS NULL
          OR s.magic_link_sent_at < NOW() - (p_magic_link_grace_days || ' days')::INTERVAL
      );
$$;

REVOKE ALL ON FUNCTION public.studio_list_expired_guest_user_ids(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_list_expired_guest_user_ids(INTEGER, INTEGER) TO service_role;

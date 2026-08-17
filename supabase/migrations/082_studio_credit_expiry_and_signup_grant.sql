-- ============================================================================
-- Migration 082: Studio credit expiry (FIFO remaining) + 10-credit starter grant
-- ============================================================================

ALTER TABLE studio_credit_ledger
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS remaining INTEGER;

ALTER TABLE studio_credit_ledger
    DROP CONSTRAINT IF EXISTS studio_credit_ledger_remaining_nonneg;
ALTER TABLE studio_credit_ledger
    ADD CONSTRAINT studio_credit_ledger_remaining_nonneg
        CHECK (remaining IS NULL OR remaining >= 0);

COMMENT ON COLUMN studio_credit_ledger.expires_at IS
    'When set, unused remaining on this grant is not spendable after this time. NULL = never expires.';
COMMENT ON COLUMN studio_credit_ledger.remaining IS
    'Unspent credits on a positive grant row. NULL on debit / expiry rows.';
COMMENT ON COLUMN studio_credit_ledger.reason IS
    'admin_grant | signup_grant | stripe_pack | generation_debit | export_variant_debit | adjustment | …';

CREATE INDEX IF NOT EXISTS idx_studio_credit_ledger_spendable
    ON studio_credit_ledger (user_id, expires_at)
    WHERE remaining > 0;

-- Grandfather existing grants: leftover balance sits on newest grants; no expiry.
DO $$
DECLARE
    u RECORD;
    g RECORD;
    leftover INTEGER;
BEGIN
    FOR u IN SELECT user_id, balance FROM studio_credit_balances LOOP
        leftover := u.balance;
        FOR g IN
            SELECT id, delta
            FROM studio_credit_ledger
            WHERE user_id = u.user_id AND delta > 0
            ORDER BY created_at DESC, id DESC
        LOOP
            UPDATE studio_credit_ledger
            SET remaining = LEAST(g.delta, leftover),
                expires_at = NULL
            WHERE id = g.id;
            leftover := leftover - LEAST(g.delta, leftover);
        END LOOP;
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS studio_apply_credit_delta(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, JSONB);

CREATE OR REPLACE FUNCTION studio_apply_credit_delta(
    p_user_id UUID,
    p_delta INTEGER,
    p_reason TEXT,
    p_ref_type TEXT DEFAULT NULL,
    p_ref_id TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(new_balance INTEGER, ledger_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
    v_ledger_id UUID;
    v_need INTEGER;
    v_take INTEGER;
    r RECORD;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;
    IF p_delta IS NULL OR p_delta = 0 THEN
        RAISE EXCEPTION 'delta must be a non-zero integer';
    END IF;
    IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
        RAISE EXCEPTION 'reason is required';
    END IF;

    INSERT INTO studio_credit_balances (user_id, balance, updated_at)
    VALUES (p_user_id, 0, NOW())
    ON CONFLICT (user_id) DO NOTHING;

    UPDATE studio_credit_ledger
    SET remaining = 0
    WHERE user_id = p_user_id
      AND remaining > 0
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    IF p_delta > 0 THEN
        INSERT INTO studio_credit_ledger (
            user_id,
            delta,
            balance_after,
            reason,
            ref_type,
            ref_id,
            created_by,
            metadata,
            expires_at,
            remaining
        )
        VALUES (
            p_user_id,
            p_delta,
            0,
            trim(p_reason),
            p_ref_type,
            p_ref_id,
            p_created_by,
            COALESCE(p_metadata, '{}'::jsonb),
            p_expires_at,
            p_delta
        )
        RETURNING id INTO v_ledger_id;
    ELSE
        SELECT COALESCE(SUM(remaining), 0) INTO v_balance
        FROM studio_credit_ledger
        WHERE user_id = p_user_id
          AND remaining > 0
          AND (expires_at IS NULL OR expires_at > NOW());

        v_need := ABS(p_delta);
        IF v_balance < v_need THEN
            RAISE EXCEPTION 'INSUFFICIENT_CREDITS'
                USING ERRCODE = 'P0001';
        END IF;

        FOR r IN
            SELECT id, remaining
            FROM studio_credit_ledger
            WHERE user_id = p_user_id
              AND remaining > 0
              AND (expires_at IS NULL OR expires_at > NOW())
            ORDER BY expires_at ASC NULLS LAST, created_at ASC, id ASC
            FOR UPDATE
        LOOP
            v_take := LEAST(r.remaining, v_need);
            UPDATE studio_credit_ledger
            SET remaining = remaining - v_take
            WHERE id = r.id;
            v_need := v_need - v_take;
            EXIT WHEN v_need = 0;
        END LOOP;

        INSERT INTO studio_credit_ledger (
            user_id,
            delta,
            balance_after,
            reason,
            ref_type,
            ref_id,
            created_by,
            metadata,
            expires_at,
            remaining
        )
        VALUES (
            p_user_id,
            p_delta,
            0,
            trim(p_reason),
            p_ref_type,
            p_ref_id,
            p_created_by,
            COALESCE(p_metadata, '{}'::jsonb),
            NULL,
            NULL
        )
        RETURNING id INTO v_ledger_id;
    END IF;

    SELECT COALESCE(SUM(remaining), 0) INTO v_balance
    FROM studio_credit_ledger
    WHERE user_id = p_user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > NOW());

    UPDATE studio_credit_balances
    SET balance = v_balance,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    UPDATE studio_credit_ledger
    SET balance_after = v_balance
    WHERE id = v_ledger_id;

    RETURN QUERY SELECT v_balance, v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION studio_apply_credit_delta(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION studio_apply_credit_delta(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ)
    TO service_role;
GRANT EXECUTE ON FUNCTION studio_apply_credit_delta(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, JSONB, TIMESTAMPTZ)
    TO supabase_auth_admin;

COMMENT ON FUNCTION studio_apply_credit_delta IS
    'Atomically grant or FIFO-debit Studio credits; spendable balance excludes expired remaining';

CREATE OR REPLACE FUNCTION studio_get_spendable_credits(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;

    UPDATE studio_credit_ledger
    SET remaining = 0
    WHERE user_id = p_user_id
      AND remaining > 0
      AND expires_at IS NOT NULL
      AND expires_at <= NOW();

    SELECT COALESCE(SUM(remaining), 0) INTO v_balance
    FROM studio_credit_ledger
    WHERE user_id = p_user_id
      AND remaining > 0
      AND (expires_at IS NULL OR expires_at > NOW());

    INSERT INTO studio_credit_balances (user_id, balance, updated_at)
    VALUES (p_user_id, v_balance, NOW())
    ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance,
        updated_at = NOW();

    RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION studio_get_spendable_credits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION studio_get_spendable_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION studio_get_spendable_credits(UUID) TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION studio_ensure_starter_credits(p_user_id UUID)
RETURNS TABLE(new_balance INTEGER, ledger_id UUID, granted BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_has_history BOOLEAN;
    v_balance INTEGER;
    v_ledger_id UUID;
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext('studio_starter:' || p_user_id::text), 1);

    SELECT EXISTS (
        SELECT 1 FROM studio_credit_ledger
        WHERE user_id = p_user_id AND delta > 0
    ) INTO v_has_history;

    IF v_has_history THEN
        v_balance := studio_get_spendable_credits(p_user_id);
        RETURN QUERY SELECT v_balance, NULL::UUID, FALSE;
        RETURN;
    END IF;

    SELECT s.new_balance, s.ledger_id
    INTO v_balance, v_ledger_id
    FROM studio_apply_credit_delta(
        p_user_id,
        10,
        'signup_grant',
        'signup',
        p_user_id::text,
        NULL,
        jsonb_build_object('credits', 10),
        NOW() + INTERVAL '12 months'
    ) AS s;

    RETURN QUERY SELECT v_balance, v_ledger_id, TRUE;
END;
$$;

REVOKE ALL ON FUNCTION studio_ensure_starter_credits(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION studio_ensure_starter_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION studio_ensure_starter_credits(UUID) TO supabase_auth_admin;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM set_config('app.is_creating_user', 'true', true);

    INSERT INTO public.profiles (id, email, plan, is_approved)
    VALUES (NEW.id, NEW.email, 'free', FALSE)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        is_approved = EXCLUDED.is_approved,
        updated_at = NOW();

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

    PERFORM set_config('app.is_creating_user', NULL, true);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.handle_new_user() IS
    'Creates user profile, free menu pack, and 10 Studio starter credits on signup';

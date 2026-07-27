-- ============================================================================
-- Migration 074: Studio credits ledger + per-dish generation failure circuit breaker
-- Chunk 6 / Phase 5 — see docs/pivot/BUILD_PLAN_CHUNK_06.md
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Credit balances (one row per user; start at 0 until admin grant)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studio_credit_balances (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE studio_credit_balances IS
    'Photo Studio credit balance per user (private beta; admin-granted)';

-- ---------------------------------------------------------------------------
-- Append-only credit ledger
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studio_credit_ledger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
    reason TEXT NOT NULL,
    ref_type TEXT,
    ref_id TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_credit_ledger_delta_nonzero CHECK (delta <> 0)
);

CREATE INDEX IF NOT EXISTS idx_studio_credit_ledger_user_created
    ON studio_credit_ledger (user_id, created_at DESC);

COMMENT ON TABLE studio_credit_ledger IS
    'Append-only Studio credit transactions (grants, generation debits)';
COMMENT ON COLUMN studio_credit_ledger.reason IS
    'admin_grant | generation_debit | adjustment | …';

-- ---------------------------------------------------------------------------
-- RLS: users read own; writes via service role / SECURITY DEFINER only
-- ---------------------------------------------------------------------------

ALTER TABLE studio_credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_credit_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own studio credit balance"
    ON studio_credit_balances FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can select own studio credit ledger"
    ON studio_credit_ledger FOR SELECT
    USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated role — admin client / RPC only.

-- ---------------------------------------------------------------------------
-- Atomic apply delta (debit or grant); never allows negative balance
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION studio_apply_credit_delta(
    p_user_id UUID,
    p_delta INTEGER,
    p_reason TEXT,
    p_ref_type TEXT DEFAULT NULL,
    p_ref_id TEXT DEFAULT NULL,
    p_created_by UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(new_balance INTEGER, ledger_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
    v_ledger_id UUID;
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

    UPDATE studio_credit_balances
    SET balance = balance + p_delta,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND balance + p_delta >= 0
    RETURNING balance INTO v_balance;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'INSUFFICIENT_CREDITS'
            USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO studio_credit_ledger (
        user_id,
        delta,
        balance_after,
        reason,
        ref_type,
        ref_id,
        created_by,
        metadata
    )
    VALUES (
        p_user_id,
        p_delta,
        v_balance,
        trim(p_reason),
        p_ref_type,
        p_ref_id,
        p_created_by,
        COALESCE(p_metadata, '{}'::jsonb)
    )
    RETURNING id INTO v_ledger_id;

    RETURN QUERY SELECT v_balance, v_ledger_id;
END;
$$;

REVOKE ALL ON FUNCTION studio_apply_credit_delta(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, JSONB)
    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION studio_apply_credit_delta(UUID, INTEGER, TEXT, TEXT, TEXT, UUID, JSONB)
    TO service_role;

COMMENT ON FUNCTION studio_apply_credit_delta IS
    'Atomically adjust Studio credit balance and append a ledger row';

-- ---------------------------------------------------------------------------
-- Per-dish billable failure circuit breaker
-- ---------------------------------------------------------------------------

ALTER TABLE studio_dishes
    ADD COLUMN IF NOT EXISTS generation_failure_count INTEGER NOT NULL DEFAULT 0
        CHECK (generation_failure_count >= 0),
    ADD COLUMN IF NOT EXISTS generation_blocked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS generation_blocked_reason TEXT;

COMMENT ON COLUMN studio_dishes.generation_failure_count IS
    'Consecutive billable provider failures on mutate; reset on successful generate';
COMMENT ON COLUMN studio_dishes.generation_blocked_at IS
    'When set, further Studio mutates for this dish are blocked until admin clears';

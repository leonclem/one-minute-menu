-- ============================================================================
-- Migration 088: Studio object-edit persistence foundations
-- Additive only. Object-edit controls remain fail-closed until a human review
-- records a per-operation decision and separately enables the relevant control.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Optional, image-bound spatial inventory. This is intentionally separate from
-- studio_images.metadata.editorState / the Minimal Schema.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_image_spatial_inventories (
    image_id UUID PRIMARY KEY REFERENCES studio_images(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dish_id UUID NOT NULL REFERENCES studio_dishes(id) ON DELETE CASCADE,
    version SMALLINT NOT NULL CHECK (version = 1),
    inventory JSONB NOT NULL,
    diagnostics_status TEXT NOT NULL DEFAULT 'validated'
        CHECK (diagnostics_status IN ('validated', 'unavailable', 'validation_failed', 'persistence_failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_image_spatial_inventory_matches_image
        CHECK ((inventory ->> 'imageId') = image_id::text)
);

CREATE INDEX IF NOT EXISTS idx_studio_image_spatial_inventories_user_dish
    ON studio_image_spatial_inventories (user_id, dish_id, updated_at DESC);

COMMENT ON TABLE studio_image_spatial_inventories IS
    'Optional, separately validated coarse spatial evidence for exactly one current Studio image.';

ALTER TABLE studio_image_spatial_inventories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own Studio spatial inventory"
    ON studio_image_spatial_inventories FOR SELECT
    USING (auth.uid() = user_id);

-- No authenticated write policy: service-role persistence only.

-- Enforce that a service-side spatial write remains bound to the same current
-- image owner and dish; the JSON imageId is constrained above.
CREATE OR REPLACE FUNCTION studio_validate_spatial_inventory_binding()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM studio_images image
        WHERE image.id = NEW.image_id
          AND image.user_id = NEW.user_id
          AND image.dish_id = NEW.dish_id
    ) THEN
        RAISE EXCEPTION 'Spatial inventory must match the image owner and dish'
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS studio_image_spatial_inventory_binding ON studio_image_spatial_inventories;
CREATE TRIGGER studio_image_spatial_inventory_binding
    BEFORE INSERT OR UPDATE ON studio_image_spatial_inventories
    FOR EACH ROW EXECUTE FUNCTION studio_validate_spatial_inventory_binding();

-- ---------------------------------------------------------------------------
-- Internal, immutable spike evidence. Artifact JSON records references/digests;
-- image bytes and raw provider responses are never stored in these records.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_object_edit_spike_cases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL CHECK (operation IN ('remove', 'move')),
    requested_model_class TEXT NOT NULL CHECK (requested_model_class IN ('nb2', 'nb_pro')),
    configured_model_identifier TEXT NOT NULL CHECK (char_length(configured_model_identifier) BETWEEN 1 AND 200),
    source_artifact JSONB NOT NULL,
    annotated_artifact JSONB NOT NULL,
    selection JSONB NOT NULL,
    placement JSONB,
    scenario_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_object_edit_spike_case_placement
        CHECK ((operation = 'move' AND placement IS NOT NULL) OR (operation = 'remove' AND placement IS NULL))
);

CREATE TABLE IF NOT EXISTS studio_object_edit_spike_comparison_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    spike_case_id UUID NOT NULL REFERENCES studio_object_edit_spike_cases(id) ON DELETE RESTRICT,
    operation TEXT NOT NULL CHECK (operation IN ('remove', 'move')),
    requested_model_class TEXT NOT NULL CHECK (requested_model_class IN ('nb2', 'nb_pro')),
    configured_model_identifier TEXT NOT NULL CHECK (char_length(configured_model_identifier) BETWEEN 1 AND 200),
    source_digest TEXT NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
    annotated_digest TEXT NOT NULL CHECK (annotated_digest ~ '^[a-f0-9]{64}$'),
    contract_digest TEXT NOT NULL CHECK (contract_digest ~ '^[a-f0-9]{64}$'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS studio_object_edit_spike_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comparison_group_id UUID NOT NULL REFERENCES studio_object_edit_spike_comparison_groups(id) ON DELETE RESTRICT,
    variant TEXT NOT NULL CHECK (variant IN ('A', 'B', 'C')),
    operation TEXT NOT NULL CHECK (operation IN ('remove', 'move')),
    requested_model_class TEXT NOT NULL CHECK (requested_model_class IN ('nb2', 'nb_pro')),
    configured_model_identifier TEXT NOT NULL CHECK (char_length(configured_model_identifier) BETWEEN 1 AND 200),
    provider_reported_model_identity TEXT,
    provider_identity_reported BOOLEAN NOT NULL DEFAULT FALSE,
    contract_digest TEXT NOT NULL CHECK (contract_digest ~ '^[a-f0-9]{64}$'),
    source_digest TEXT NOT NULL CHECK (source_digest ~ '^[a-f0-9]{64}$'),
    annotated_digest TEXT NOT NULL CHECK (annotated_digest ~ '^[a-f0-9]{64}$'),
    outcome TEXT NOT NULL CHECK (outcome IN ('generated', 'provider_error', 'transport_error', 'validation_error')),
    output_artifact JSONB,
    failure_artifact JSONB,
    no_failure_artifact_returned BOOLEAN NOT NULL DEFAULT FALSE,
    scores JSONB NOT NULL,
    observations TEXT[] NOT NULL DEFAULT '{}'::text[],
    failure_notes TEXT[] NOT NULL DEFAULT '{}'::text[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_object_edit_spike_execution_variant_unique UNIQUE (comparison_group_id, variant),
    CONSTRAINT studio_object_edit_spike_execution_result_artifact
        CHECK ((outcome = 'generated' AND output_artifact IS NOT NULL) OR outcome <> 'generated'),
    CONSTRAINT studio_object_edit_spike_execution_failure_artifact
        CHECK (NOT (failure_artifact IS NOT NULL AND no_failure_artifact_returned = TRUE)),
    CONSTRAINT studio_object_edit_spike_execution_identity_flag
        CHECK ((provider_identity_reported = TRUE AND provider_reported_model_identity IS NOT NULL)
            OR (provider_identity_reported = FALSE AND provider_reported_model_identity IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_studio_object_edit_spike_cases_operation_model
    ON studio_object_edit_spike_cases (operation, requested_model_class, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_object_edit_spike_groups_case
    ON studio_object_edit_spike_comparison_groups (spike_case_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_object_edit_spike_executions_operation_model
    ON studio_object_edit_spike_executions (operation, requested_model_class, created_at DESC);

CREATE TABLE IF NOT EXISTS studio_object_edit_spike_evidence_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL CHECK (operation IN ('remove', 'move')),
    label TEXT NOT NULL CHECK (char_length(btrim(label)) BETWEEN 1 AND 200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_object_edit_spike_evidence_sets_operation_unique UNIQUE (id, operation)
);

CREATE TABLE IF NOT EXISTS studio_object_edit_spike_evidence_set_executions (
    evidence_set_id UUID NOT NULL REFERENCES studio_object_edit_spike_evidence_sets(id) ON DELETE RESTRICT,
    execution_id UUID NOT NULL REFERENCES studio_object_edit_spike_executions(id) ON DELETE RESTRICT,
    PRIMARY KEY (evidence_set_id, execution_id)
);

CREATE TABLE IF NOT EXISTS studio_object_edit_spike_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    evidence_set_id UUID NOT NULL REFERENCES studio_object_edit_spike_evidence_sets(id) ON DELETE RESTRICT,
    operation TEXT NOT NULL CHECK (operation IN ('remove', 'move')),
    reviewer_user_id UUID NOT NULL,
    decision TEXT NOT NULL CHECK (decision IN ('go', 'no_go')),
    rationale TEXT NOT NULL CHECK (char_length(btrim(rationale)) BETWEEN 1 AND 4000),
    spatial_usefulness TEXT NOT NULL CHECK (spatial_usefulness IN ('useful', 'not_useful', 'inconclusive')),
    reviewed_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_object_edit_spike_reviews_evidence_set_unique UNIQUE (evidence_set_id)
);

-- ---------------------------------------------------------------------------
-- Independent Release Control state and append-only audit stream.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS studio_object_edit_operation_controls (
    operation TEXT PRIMARY KEY CHECK (operation IN ('remove', 'move')),
    decision TEXT NOT NULL DEFAULT 'pending' CHECK (decision IN ('pending', 'go', 'no_go')),
    decision_at TIMESTAMPTZ,
    reviewer_user_id UUID,
    rationale TEXT,
    evidence_set_id UUID REFERENCES studio_object_edit_spike_evidence_sets(id) ON DELETE RESTRICT,
    spatial_usefulness TEXT NOT NULL DEFAULT 'pending'
        CHECK (spatial_usefulness IN ('pending', 'useful', 'not_useful', 'inconclusive')),
    internal_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    production_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_object_edit_operation_control_decision_evidence
        CHECK (
            (decision = 'pending'
                AND decision_at IS NULL
                AND reviewer_user_id IS NULL
                AND rationale IS NULL
                AND evidence_set_id IS NULL)
            OR
            (decision IN ('go', 'no_go')
                AND decision_at IS NOT NULL
                AND reviewer_user_id IS NOT NULL
                AND char_length(btrim(COALESCE(rationale, ''))) > 0
                AND evidence_set_id IS NOT NULL)
        )
);

CREATE TABLE IF NOT EXISTS studio_object_edit_operation_control_audit_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation TEXT NOT NULL REFERENCES studio_object_edit_operation_controls(operation) ON DELETE RESTRICT,
    actor_user_id UUID NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('control_updated')),
    previous_state JSONB NOT NULL,
    next_state JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_object_edit_operation_control_audit_operation_created
    ON studio_object_edit_operation_control_audit_events (operation, created_at DESC);

INSERT INTO studio_object_edit_operation_controls (operation, decision, spatial_usefulness, internal_enabled, production_enabled)
VALUES
    ('remove', 'pending', 'pending', FALSE, FALSE),
    ('move', 'pending', 'pending', FALSE, FALSE)
ON CONFLICT (operation) DO NOTHING;

ALTER TABLE studio_object_edit_spike_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_spike_comparison_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_spike_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_spike_evidence_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_spike_evidence_set_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_spike_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_operation_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_object_edit_operation_control_audit_events ENABLE ROW LEVEL SECURITY;

-- No policies are intentionally created for evidence/control rows. They are
-- internal service-role records; client reads and all client writes are denied.

-- Immutable evidence/audit rows prevent accidental historical rewrites even by
-- application code using the service client. New records remain insert-only.
CREATE OR REPLACE FUNCTION studio_reject_object_edit_immutable_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME
        USING ERRCODE = '55000';
END;
$$;

DROP TRIGGER IF EXISTS studio_object_edit_spike_cases_immutable ON studio_object_edit_spike_cases;
CREATE TRIGGER studio_object_edit_spike_cases_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_spike_cases
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();
DROP TRIGGER IF EXISTS studio_object_edit_spike_groups_immutable ON studio_object_edit_spike_comparison_groups;
CREATE TRIGGER studio_object_edit_spike_groups_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_spike_comparison_groups
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();
DROP TRIGGER IF EXISTS studio_object_edit_spike_executions_immutable ON studio_object_edit_spike_executions;
CREATE TRIGGER studio_object_edit_spike_executions_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_spike_executions
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();
DROP TRIGGER IF EXISTS studio_object_edit_spike_evidence_sets_immutable ON studio_object_edit_spike_evidence_sets;
CREATE TRIGGER studio_object_edit_spike_evidence_sets_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_spike_evidence_sets
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();
DROP TRIGGER IF EXISTS studio_object_edit_spike_evidence_set_executions_immutable ON studio_object_edit_spike_evidence_set_executions;
CREATE TRIGGER studio_object_edit_spike_evidence_set_executions_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_spike_evidence_set_executions
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();
DROP TRIGGER IF EXISTS studio_object_edit_spike_reviews_immutable ON studio_object_edit_spike_reviews;
CREATE TRIGGER studio_object_edit_spike_reviews_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_spike_reviews
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();
DROP TRIGGER IF EXISTS studio_object_edit_operation_control_audit_immutable ON studio_object_edit_operation_control_audit_events;
CREATE TRIGGER studio_object_edit_operation_control_audit_immutable
    BEFORE UPDATE OR DELETE ON studio_object_edit_operation_control_audit_events
    FOR EACH ROW EXECUTE FUNCTION studio_reject_object_edit_immutable_mutation();

-- ---------------------------------------------------------------------------
-- Atomic helpers. Both functions are service-role-only and preserve existing
-- credit semantics by calling the current FIFO studio_apply_credit_delta RPC.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION studio_update_object_edit_operation_control(
    p_operation TEXT,
    p_actor_user_id UUID,
    p_decision TEXT,
    p_decision_at TIMESTAMPTZ,
    p_reviewer_user_id UUID,
    p_rationale TEXT,
    p_evidence_set_id UUID,
    p_spatial_usefulness TEXT,
    p_internal_enabled BOOLEAN,
    p_production_enabled BOOLEAN
)
RETURNS SETOF studio_object_edit_operation_controls
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_previous JSONB;
    v_next studio_object_edit_operation_controls%ROWTYPE;
BEGIN
    IF p_operation NOT IN ('remove', 'move') THEN
        RAISE EXCEPTION 'Invalid object-edit operation' USING ERRCODE = '22023';
    END IF;
    IF p_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'actor_user_id is required' USING ERRCODE = '22023';
    END IF;
    IF p_decision NOT IN ('pending', 'go', 'no_go') THEN
        RAISE EXCEPTION 'Invalid object-edit decision' USING ERRCODE = '22023';
    END IF;
    IF p_spatial_usefulness NOT IN ('pending', 'useful', 'not_useful', 'inconclusive') THEN
        RAISE EXCEPTION 'Invalid spatial usefulness finding' USING ERRCODE = '22023';
    END IF;

    SELECT to_jsonb(c.*) INTO v_previous
    FROM studio_object_edit_operation_controls c
    WHERE c.operation = p_operation
    FOR UPDATE;

    IF v_previous IS NULL THEN
        RAISE EXCEPTION 'Object-edit operation control not found' USING ERRCODE = 'P0002';
    END IF;

    IF p_decision IN ('go', 'no_go')
        AND (p_decision_at IS NULL OR p_reviewer_user_id IS NULL
            OR char_length(btrim(COALESCE(p_rationale, ''))) = 0 OR p_evidence_set_id IS NULL) THEN
        RAISE EXCEPTION 'Reviewed decisions require date, reviewer, rationale, and evidence set'
            USING ERRCODE = '22023';
    END IF;

    IF p_decision = 'pending'
        AND (p_decision_at IS NOT NULL OR p_reviewer_user_id IS NOT NULL
            OR p_rationale IS NOT NULL OR p_evidence_set_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Pending decisions cannot retain review fields' USING ERRCODE = '22023';
    END IF;

    IF p_evidence_set_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM studio_object_edit_spike_evidence_sets e
        WHERE e.id = p_evidence_set_id AND e.operation = p_operation
    ) THEN
        RAISE EXCEPTION 'Evidence set must belong to the controlled operation' USING ERRCODE = '22023';
    END IF;

    UPDATE studio_object_edit_operation_controls
    SET decision = p_decision,
        decision_at = p_decision_at,
        reviewer_user_id = p_reviewer_user_id,
        rationale = NULLIF(btrim(p_rationale), ''),
        evidence_set_id = p_evidence_set_id,
        spatial_usefulness = p_spatial_usefulness,
        internal_enabled = COALESCE(p_internal_enabled, FALSE),
        production_enabled = COALESCE(p_production_enabled, FALSE),
        updated_at = NOW()
    WHERE operation = p_operation
    RETURNING * INTO v_next;

    INSERT INTO studio_object_edit_operation_control_audit_events (
        operation, actor_user_id, event_type, previous_state, next_state
    ) VALUES (
        p_operation, p_actor_user_id, 'control_updated', v_previous, to_jsonb(v_next)
    );

    RETURN NEXT v_next;
END;
$$;

CREATE OR REPLACE FUNCTION studio_create_object_edit_spike_evidence_set(
    p_evidence_set_id UUID,
    p_operation TEXT,
    p_label TEXT,
    p_reviewer_user_id UUID,
    p_decision TEXT,
    p_rationale TEXT,
    p_spatial_usefulness TEXT,
    p_reviewed_at TIMESTAMPTZ,
    p_execution_ids UUID[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_execution_count INTEGER;
BEGIN
    IF p_evidence_set_id IS NULL OR p_operation NOT IN ('remove', 'move')
        OR char_length(btrim(COALESCE(p_label, ''))) = 0
        OR p_reviewer_user_id IS NULL
        OR p_decision NOT IN ('go', 'no_go')
        OR char_length(btrim(COALESCE(p_rationale, ''))) = 0
        OR p_spatial_usefulness NOT IN ('useful', 'not_useful', 'inconclusive')
        OR p_reviewed_at IS NULL
        OR COALESCE(array_length(p_execution_ids, 1), 0) = 0 THEN
        RAISE EXCEPTION 'Incomplete immutable evidence review' USING ERRCODE = '22023';
    END IF;

    IF cardinality(p_execution_ids) <> cardinality(ARRAY(SELECT DISTINCT unnest(p_execution_ids))) THEN
        RAISE EXCEPTION 'Evidence execution IDs must be unique' USING ERRCODE = '22023';
    END IF;

    SELECT COUNT(*) INTO v_execution_count
    FROM studio_object_edit_spike_executions
    WHERE id = ANY(p_execution_ids) AND operation = p_operation;

    IF v_execution_count <> cardinality(p_execution_ids) THEN
        RAISE EXCEPTION 'Evidence executions must exist and belong to the reviewed operation'
            USING ERRCODE = '22023';
    END IF;

    INSERT INTO studio_object_edit_spike_evidence_sets (id, operation, label)
    VALUES (p_evidence_set_id, p_operation, btrim(p_label));

    INSERT INTO studio_object_edit_spike_evidence_set_executions (evidence_set_id, execution_id)
    SELECT p_evidence_set_id, execution_id
    FROM unnest(p_execution_ids) AS execution_id;

    INSERT INTO studio_object_edit_spike_reviews (
        evidence_set_id, operation, reviewer_user_id, decision, rationale, spatial_usefulness, reviewed_at
    ) VALUES (
        p_evidence_set_id, p_operation, p_reviewer_user_id, p_decision,
        btrim(p_rationale), p_spatial_usefulness, p_reviewed_at
    );

    RETURN p_evidence_set_id;
END;
$$;

CREATE OR REPLACE FUNCTION studio_commit_generated_image_v2(
    p_user_id UUID,
    p_dish_id UUID,
    p_source_image_id UUID,
    p_child_image_id UUID,
    p_storage_path TEXT,
    p_public_url TEXT,
    p_mime_type TEXT,
    p_width INTEGER,
    p_height INTEGER,
    p_prompt TEXT,
    p_model TEXT,
    p_metadata JSONB,
    p_credit_cost INTEGER
)
RETURNS TABLE (
    image_id UUID,
    image_url TEXT,
    dish_id UUID,
    model TEXT,
    balance_after INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_balance INTEGER;
BEGIN
    IF p_user_id IS NULL OR p_dish_id IS NULL OR p_source_image_id IS NULL OR p_child_image_id IS NULL THEN
        RAISE EXCEPTION 'User, dish, source image, and child image IDs are required' USING ERRCODE = '22023';
    END IF;
    IF p_credit_cost IS NULL OR p_credit_cost <= 0 THEN
        RAISE EXCEPTION 'A positive credit cost is required' USING ERRCODE = '22023';
    END IF;
    IF char_length(btrim(COALESCE(p_storage_path, ''))) = 0
        OR char_length(btrim(COALESCE(p_public_url, ''))) = 0
        OR char_length(btrim(COALESCE(p_mime_type, ''))) = 0 THEN
        RAISE EXCEPTION 'Generated image storage details are required' USING ERRCODE = '22023';
    END IF;

    PERFORM 1
    FROM studio_dishes d
    JOIN studio_images s ON s.id = p_source_image_id
    WHERE d.id = p_dish_id
      AND d.user_id = p_user_id
      AND s.user_id = p_user_id
      AND s.dish_id = p_dish_id
      AND s.archived_at IS NULL
    FOR UPDATE OF d, s;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Studio dish/source ownership relationship not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO studio_images (
        id, user_id, dish_id, role, source_image_id, storage_path, public_url,
        mime_type, width, height, prompt, model, metadata, is_favourite, archived_at
    ) VALUES (
        p_child_image_id, p_user_id, p_dish_id, 'generated', p_source_image_id,
        p_storage_path, p_public_url, p_mime_type, p_width, p_height,
        p_prompt, p_model, COALESCE(p_metadata, '{}'::jsonb), FALSE, NULL
    );

    SELECT new_balance INTO v_balance
    FROM studio_apply_credit_delta(
        p_user_id,
        -p_credit_cost,
        'generation_debit',
        'studio_image',
        p_child_image_id::text,
        p_user_id,
        jsonb_build_object('model', p_model, 'cost', p_credit_cost),
        NULL
    );

    UPDATE studio_dishes
    SET current_image_id = p_child_image_id,
        generation_failure_count = 0,
        generation_blocked_at = NULL,
        generation_blocked_reason = NULL,
        updated_at = NOW()
    WHERE id = p_dish_id AND user_id = p_user_id;

    RETURN QUERY SELECT p_child_image_id, p_public_url, p_dish_id, p_model, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION studio_update_object_edit_operation_control(TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION studio_create_object_edit_spike_evidence_set(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION studio_commit_generated_image_v2(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION studio_update_object_edit_operation_control(TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION studio_create_object_edit_spike_evidence_set(UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION studio_commit_generated_image_v2(UUID, UUID, UUID, UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, JSONB, INTEGER) TO service_role;

COMMENT ON FUNCTION studio_commit_generated_image_v2 IS
    'Atomically commits an object-edit child image, direct-parent lineage, current image, failure reset, and existing FIFO credit debit.';

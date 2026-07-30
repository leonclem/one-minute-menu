-- ===========================================================================
-- Migration 076: Studio beta access entitlement + per-image generation feedback
-- Chunk 7 / Phase 6 — see docs/pivot/BUILD_PLAN_CHUNK_07.md
-- Additive only. Applies to a database at migration 073; takes no dependency
-- on 074_studio_credits.sql or 075_studio_style_descriptors.sql.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Beta access entitlement (one row per user; absent row == no access)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studio_beta_access (
    user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    granted_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    note        TEXT,
    granted_at  TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_beta_access_note_len CHECK (note IS NULL OR char_length(note) <= 280)
);

CREATE INDEX IF NOT EXISTS idx_studio_beta_access_enabled
    ON studio_beta_access (enabled, updated_at DESC);

COMMENT ON TABLE studio_beta_access IS
    'Photo Studio private-beta entitlement per user (admin-granted; audit trail retained on revoke)';
COMMENT ON COLUMN studio_beta_access.enabled IS
    'TRUE grants Studio access when NEXT_PUBLIC_STUDIO_ACCESS_MODE=beta';
COMMENT ON COLUMN studio_beta_access.revoked_at IS
    'Set on revoke; granted_by/granted_at are retained for audit';

-- ---------------------------------------------------------------------------
-- Generation feedback (one editable row per user per Studio image)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS studio_image_feedback (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_image_id UUID NOT NULL REFERENCES studio_images(id) ON DELETE CASCADE,
    dish_id         UUID REFERENCES studio_dishes(id) ON DELETE SET NULL,
    rating          SMALLINT,
    reason_tags     TEXT[] NOT NULL DEFAULT '{}'::text[],
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_image_feedback_unique_user_image
        UNIQUE (user_id, studio_image_id),
    CONSTRAINT studio_image_feedback_rating_range
        CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5)),
    CONSTRAINT studio_image_feedback_comment_len
        CHECK (comment IS NULL OR char_length(comment) <= 1000),
    CONSTRAINT studio_image_feedback_tags_known
        CHECK (reason_tags <@ ARRAY[
            'identity_changed', 'style_missed', 'unwanted_prop', 'useful_result'
        ]::text[]),
    CONSTRAINT studio_image_feedback_not_empty
        CHECK (
            rating IS NOT NULL
            OR array_length(reason_tags, 1) IS NOT NULL
            OR (comment IS NOT NULL AND char_length(btrim(comment)) > 0)
        )
);

CREATE INDEX IF NOT EXISTS idx_studio_image_feedback_created
    ON studio_image_feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_image_feedback_user
    ON studio_image_feedback (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_image_feedback_dish
    ON studio_image_feedback (dish_id, created_at DESC);

COMMENT ON TABLE studio_image_feedback IS
    'Optional tester feedback on a generated Studio image. Never stores image bytes, prompt text, or extracted JSON.';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE studio_beta_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_image_feedback ENABLE ROW LEVEL SECURITY;

-- studio_beta_access: read own row only. No INSERT/UPDATE/DELETE policy for
-- `authenticated` — all writes go through the admin client / service role.
CREATE POLICY "Users can select own studio beta access"
    ON studio_beta_access FOR SELECT
    USING (auth.uid() = user_id);

-- studio_image_feedback: own-row select, insert, update. No DELETE policy —
-- feedback is superseded by update, never removed by the user.
CREATE POLICY "Users can select own studio image feedback"
    ON studio_image_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studio image feedback"
    ON studio_image_feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own studio image feedback"
    ON studio_image_feedback FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

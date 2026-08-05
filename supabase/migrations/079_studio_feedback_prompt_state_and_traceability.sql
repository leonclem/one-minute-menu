-- Keep Studio feedback prompts per generated image and retain the generation
-- context needed to investigate customer feedback without copying image bytes
-- or model prompt text.

ALTER TABLE studio_image_feedback
    ADD COLUMN IF NOT EXISTS source_image_id UUID,
    ADD COLUMN IF NOT EXISTS requested_modifications JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Feedback is evidence for quality improvement. Keep it if an output image is
-- later deleted, while retaining the output UUID as its immutable identifier.
ALTER TABLE studio_image_feedback
    DROP CONSTRAINT IF EXISTS studio_image_feedback_studio_image_id_fkey;

ALTER TABLE studio_image_feedback
    DROP CONSTRAINT IF EXISTS studio_image_feedback_tags_known;

ALTER TABLE studio_image_feedback
    ADD CONSTRAINT studio_image_feedback_tags_known
    CHECK (reason_tags <@ ARRAY[
        'identity_changed',
        'style_missed',
        'unwanted_prop',
        'obviously_fake',
        'useful_result'
    ]::text[]);

-- Backfill records that still have their corresponding generated image. The
-- source identifier and target editor state are snapshots, so future image
-- changes or source deletion cannot alter the recorded feedback context.
UPDATE studio_image_feedback AS feedback
SET
    source_image_id = image.source_image_id,
    requested_modifications = jsonb_strip_nulls(
        jsonb_build_object(
            'change_summary',
            CASE
                WHEN jsonb_typeof(image.metadata -> 'changeSummary') = 'array'
                    THEN image.metadata -> 'changeSummary'
                ELSE '[]'::jsonb
            END,
            'target_editor_state',
            CASE
                WHEN jsonb_typeof(image.metadata -> 'editorState') = 'object'
                    THEN image.metadata -> 'editorState'
                ELSE NULL
            END
        )
    )
FROM studio_images AS image
WHERE image.id = feedback.studio_image_id;

COMMENT ON COLUMN studio_image_feedback.source_image_id IS
    'Snapshot of the direct source/reference image used for the generated output.';
COMMENT ON COLUMN studio_image_feedback.requested_modifications IS
    'Snapshot of user-requested generation changes: change summary and target editor state; never stores image bytes or prompt text.';

CREATE INDEX IF NOT EXISTS idx_studio_image_feedback_source_image
    ON studio_image_feedback (source_image_id, created_at DESC);

CREATE TABLE IF NOT EXISTS studio_image_feedback_dismissals (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    studio_image_id UUID NOT NULL,
    dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT studio_image_feedback_dismissals_unique_user_image
        UNIQUE (user_id, studio_image_id)
);

CREATE INDEX IF NOT EXISTS idx_studio_image_feedback_dismissals_user
    ON studio_image_feedback_dismissals (user_id, dismissed_at DESC);

COMMENT ON TABLE studio_image_feedback_dismissals IS
    'Per-user, per-generated-image acknowledgement that suppresses future feedback prompts.';

ALTER TABLE studio_image_feedback_dismissals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own studio feedback dismissals"
    ON studio_image_feedback_dismissals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studio feedback dismissals"
    ON studio_image_feedback_dismissals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

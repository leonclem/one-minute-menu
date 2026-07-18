-- Photo Studio: lightweight user-owned image persistence (Chunk 2)
-- Full project/dish model deferred to a later chunk.

CREATE TABLE IF NOT EXISTS studio_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('source', 'generated')),
    source_image_id UUID REFERENCES studio_images(id) ON DELETE SET NULL,
    storage_path VARCHAR(500) NOT NULL,
    public_url VARCHAR(500) NOT NULL,
    mime_type VARCHAR(50) NOT NULL,
    width INTEGER,
    height INTEGER,
    prompt TEXT,
    model VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_images_user_created
    ON studio_images (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_images_user_role_created
    ON studio_images (user_id, role, created_at DESC);

ALTER TABLE studio_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own studio images"
    ON studio_images FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studio images"
    ON studio_images FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own studio images"
    ON studio_images FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON TABLE studio_images IS
    'Photo Studio source and generated images owned by a user (menu-independent).';

-- Photo Studio Chunk 3: dish-scoped image library
-- Lean model: studio_dishes (no projects); evolve studio_images in place.

CREATE TABLE IF NOT EXISTS studio_dishes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_studio_dishes_user_updated
    ON studio_dishes (user_id, updated_at DESC);

ALTER TABLE studio_dishes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own studio dishes"
    ON studio_dishes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own studio dishes"
    ON studio_dishes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own studio dishes"
    ON studio_dishes FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own studio dishes"
    ON studio_dishes FOR DELETE
    USING (auth.uid() = user_id);

COMMENT ON TABLE studio_dishes IS
    'Photo Studio dishes owned by a user; groups studio_images without menu linkage.';

-- Evolve studio_images for per-dish library
ALTER TABLE studio_images
    ADD COLUMN IF NOT EXISTS dish_id UUID REFERENCES studio_dishes(id) ON DELETE RESTRICT,
    ADD COLUMN IF NOT EXISTS is_favourite BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

CREATE INDEX IF NOT EXISTS idx_studio_images_user_dish_created
    ON studio_images (user_id, dish_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_studio_images_dish_active
    ON studio_images (dish_id, created_at DESC)
    WHERE archived_at IS NULL;

-- At most one favourite per dish among non-archived images
CREATE UNIQUE INDEX IF NOT EXISTS idx_studio_images_one_favourite_per_dish
    ON studio_images (dish_id)
    WHERE is_favourite = true AND archived_at IS NULL AND dish_id IS NOT NULL;

-- Backfill: one default dish per user who already has studio_images
INSERT INTO studio_dishes (user_id, name)
SELECT DISTINCT si.user_id, 'My dishes'
FROM studio_images si
WHERE si.dish_id IS NULL
  AND NOT EXISTS (
      SELECT 1 FROM studio_dishes sd WHERE sd.user_id = si.user_id AND sd.name = 'My dishes'
  );

UPDATE studio_images si
SET dish_id = sd.id
FROM studio_dishes sd
WHERE si.dish_id IS NULL
  AND sd.user_id = si.user_id
  AND sd.name = 'My dishes';

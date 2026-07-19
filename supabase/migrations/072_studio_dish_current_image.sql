-- Persist which variant is "Current" for each dish (Chunk 3 UX feedback).

ALTER TABLE studio_dishes
    ADD COLUMN IF NOT EXISTS current_image_id UUID REFERENCES studio_images(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_studio_dishes_current_image
    ON studio_dishes (current_image_id)
    WHERE current_image_id IS NOT NULL;

COMMENT ON COLUMN studio_dishes.current_image_id IS
    'Last selected / generated image shown as Current for this dish.';

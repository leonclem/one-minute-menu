-- ============================================================================
-- Migration 061: Uploaded Item Images
-- Adds a table to track user-uploaded images per menu item, enabling them to
-- appear in the photo gallery alongside AI-generated images.
-- ============================================================================

-- ============================================================================
-- 1. Create uploaded_item_images table
-- ============================================================================

CREATE TABLE IF NOT EXISTS uploaded_item_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

    -- Storage URL (public URL from Supabase Storage)
    original_url VARCHAR(1000) NOT NULL,

    -- Optional display metadata
    file_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(50),

    -- Whether this image is currently selected as the active image for the item
    selected BOOLEAN DEFAULT false NOT NULL,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE uploaded_item_images IS 'User-uploaded photos for menu items. Displayed alongside AI-generated images in the photo gallery.';
COMMENT ON COLUMN uploaded_item_images.id IS 'Primary key';
COMMENT ON COLUMN uploaded_item_images.menu_item_id IS 'FK to menu_items — the item this photo belongs to';
COMMENT ON COLUMN uploaded_item_images.user_id IS 'FK to auth.users — the uploader (for RLS and quota)';
COMMENT ON COLUMN uploaded_item_images.original_url IS 'Public URL of the uploaded image in Supabase Storage';
COMMENT ON COLUMN uploaded_item_images.file_name IS 'Original filename provided by the user';
COMMENT ON COLUMN uploaded_item_images.file_size IS 'File size in bytes';
COMMENT ON COLUMN uploaded_item_images.mime_type IS 'MIME type of the uploaded file (image/jpeg, image/png, image/webp)';
COMMENT ON COLUMN uploaded_item_images.selected IS 'True when this image is the active photo for the menu item';

-- ============================================================================
-- 2. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_uploaded_item_images_menu_item ON uploaded_item_images(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_item_images_user ON uploaded_item_images(user_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_item_images_selected ON uploaded_item_images(menu_item_id, selected) WHERE selected = true;

-- ============================================================================
-- 3. updated_at trigger
-- ============================================================================

CREATE TRIGGER update_uploaded_item_images_updated_at
    BEFORE UPDATE ON uploaded_item_images
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 4. Row Level Security
-- ============================================================================

ALTER TABLE uploaded_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own uploaded images" ON uploaded_item_images
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own uploaded images" ON uploaded_item_images
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own uploaded images" ON uploaded_item_images
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own uploaded images" ON uploaded_item_images
    FOR DELETE USING (auth.uid() = user_id);

-- ============================================================================
-- 5. Helper function: select an uploaded image for a menu item
--    Deselects all other uploaded images and all AI images for the item,
--    then marks the chosen uploaded image as selected.
-- ============================================================================

CREATE OR REPLACE FUNCTION select_uploaded_image_for_menu_item(
    p_menu_item_id UUID,
    p_image_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Deselect all AI-generated images for this item
    UPDATE ai_generated_images
    SET selected = false
    WHERE menu_item_id = p_menu_item_id;

    -- Deselect all other uploaded images for this item
    UPDATE uploaded_item_images
    SET selected = false
    WHERE menu_item_id = p_menu_item_id;

    -- Select the specified uploaded image
    UPDATE uploaded_item_images
    SET selected = true
    WHERE id = p_image_id AND menu_item_id = p_menu_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Uploaded image % not found for menu item %', p_image_id, p_menu_item_id;
    END IF;

    -- Update the menu item record to reflect the custom image source
    UPDATE menu_items
    SET
        image_source = 'custom',
        ai_image_id = NULL,
        custom_image_url = (SELECT original_url FROM uploaded_item_images WHERE id = p_image_id)
    WHERE id = p_menu_item_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION select_uploaded_image_for_menu_item IS 'Atomically selects an uploaded image for a menu item, deselecting all other images.';

-- ============================================================================
-- 6. Add item_id column to uploads log table (for per-item quota tracking)
--    The existing route inserts with item_id but the column was missing.
-- ============================================================================

ALTER TABLE uploads ADD COLUMN IF NOT EXISTS item_id UUID;

COMMENT ON COLUMN uploads.item_id IS 'Optional FK to the menu item this upload is associated with';

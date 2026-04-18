-- ============================================================================
-- Migration 062: Preserve custom_image_url when selecting an AI image
--
-- Previously, select_ai_image_for_menu_item set custom_image_url = NULL when
-- switching to an AI image. This destroyed the URL of any user-uploaded photo,
-- making it disappear from the gallery when the user switched back.
--
-- Fix: only update image_source and ai_image_id. custom_image_url is now
-- treated as a persistent asset reference, not an "active image" pointer.
-- The imageSource field is the authoritative indicator of which source is active.
-- ============================================================================

CREATE OR REPLACE FUNCTION select_ai_image_for_menu_item(
    p_menu_item_id UUID,
    p_image_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Unselect all AI images for this menu item
    UPDATE ai_generated_images
    SET selected = false
    WHERE menu_item_id = p_menu_item_id;

    -- Select the specified image
    UPDATE ai_generated_images
    SET selected = true
    WHERE id = p_image_id AND menu_item_id = p_menu_item_id;

    -- Update the menu item to reference this AI image.
    -- Intentionally do NOT null custom_image_url — uploaded images stored there
    -- must persist so they remain visible in the gallery when the user switches sources.
    UPDATE menu_items
    SET
        ai_image_id = p_image_id,
        image_source = 'ai'
    WHERE id = p_menu_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Image not found or does not belong to menu item';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION select_ai_image_for_menu_item IS
    'Atomically select an AI-generated image for a menu item. Preserves custom_image_url so uploaded photos remain available in the gallery.';

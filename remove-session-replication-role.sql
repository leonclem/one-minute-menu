-- Remove all uses of session_replication_role from database functions
-- This parameter requires superuser privileges which we don't have

-- Drop all the problematic functions and triggers
DROP TRIGGER IF EXISTS sync_menu_items_insert ON menu_items;
DROP TRIGGER IF EXISTS sync_menu_items_update ON menu_items;
DROP TRIGGER IF EXISTS sync_menu_items_delete ON menu_items;
DROP TRIGGER IF EXISTS sync_menus_to_items ON menus;

DROP FUNCTION IF EXISTS sync_menu_item_changes();
DROP FUNCTION IF EXISTS sync_jsonb_to_menu_items();
DROP FUNCTION IF EXISTS select_ai_image_for_menu_item(UUID, UUID);

-- Recreate select_ai_image_for_menu_item WITHOUT session_replication_role
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
    
    -- Update the menu item to reference this AI image
    UPDATE menu_items 
    SET 
        ai_image_id = p_image_id,
        image_source = 'ai',
        custom_image_url = NULL
    WHERE id = p_menu_item_id;
    
    -- Verify the image was found and updated
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Image not found or does not belong to menu item';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION select_ai_image_for_menu_item(UUID, UUID) TO authenticated;

SELECT 'All session_replication_role references removed!' as status;

-- Fix the select_ai_image_for_menu_item function to not require superuser permissions
-- Run this in your Supabase SQL Editor

-- Drop and recreate the function without session_replication_role
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

SELECT 'Function updated successfully!' as status;
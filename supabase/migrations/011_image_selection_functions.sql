-- Migration 011: Add functions for image selection logic
-- This migration adds database functions to handle atomic image selection

-- Function to select an AI-generated image for a menu item
-- This ensures only one image is selected at a time per menu item
CREATE OR REPLACE FUNCTION select_ai_image_for_menu_item(
    p_menu_item_id UUID,
    p_image_id UUID
)
RETURNS VOID AS $$
BEGIN
    -- Start transaction (implicit in function)
    
    -- First, unselect all AI images for this menu item
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

-- Function to get all variations for a menu item with selection status
CREATE OR REPLACE FUNCTION get_menu_item_variations(p_menu_item_id UUID)
RETURNS TABLE (
    image_id UUID,
    generation_job_id UUID,
    original_url VARCHAR(500),
    thumbnail_url VARCHAR(500),
    mobile_url VARCHAR(500),
    desktop_url VARCHAR(500),
    webp_url VARCHAR(500),
    prompt TEXT,
    negative_prompt TEXT,
    aspect_ratio VARCHAR(10),
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    selected BOOLEAN,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ai.id,
        ai.generation_job_id,
        ai.original_url,
        ai.thumbnail_url,
        ai.mobile_url,
        ai.desktop_url,
        ai.webp_url,
        ai.prompt,
        ai.negative_prompt,
        ai.aspect_ratio,
        ai.width,
        ai.height,
        ai.file_size,
        ai.selected,
        ai.metadata,
        ai.created_at
    FROM ai_generated_images ai
    WHERE ai.menu_item_id = p_menu_item_id
    ORDER BY ai.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to switch to custom image (unselect all AI images)
CREATE OR REPLACE FUNCTION select_custom_image_for_menu_item(
    p_menu_item_id UUID,
    p_custom_image_url VARCHAR(500)
)
RETURNS VOID AS $$
BEGIN
    -- Unselect all AI images for this menu item
    UPDATE ai_generated_images 
    SET selected = false 
    WHERE menu_item_id = p_menu_item_id;
    
    -- Update menu item to use custom image
    UPDATE menu_items 
    SET 
        custom_image_url = p_custom_image_url,
        ai_image_id = NULL,
        image_source = 'custom'
    WHERE id = p_menu_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Menu item not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove all images from a menu item
CREATE OR REPLACE FUNCTION remove_all_images_from_menu_item(p_menu_item_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Unselect all AI images for this menu item
    UPDATE ai_generated_images 
    SET selected = false 
    WHERE menu_item_id = p_menu_item_id;
    
    -- Clear image references from menu item
    UPDATE menu_items 
    SET 
        custom_image_url = NULL,
        ai_image_id = NULL,
        image_source = 'none'
    WHERE id = p_menu_item_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Menu item not found';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to delete a specific AI-generated image
-- This also handles cleanup if it was the selected image
CREATE OR REPLACE FUNCTION delete_ai_generated_image(p_image_id UUID)
RETURNS VOID AS $$
DECLARE
    v_menu_item_id UUID;
    v_was_selected BOOLEAN;
    v_remaining_count INTEGER;
    v_next_image_id UUID;
BEGIN
    -- Get the menu item ID and selection status
    SELECT menu_item_id, selected 
    INTO v_menu_item_id, v_was_selected
    FROM ai_generated_images 
    WHERE id = p_image_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'AI-generated image not found';
    END IF;
    
    -- Delete the image
    DELETE FROM ai_generated_images WHERE id = p_image_id;
    
    -- If this was the selected image, we need to handle the selection
    IF v_was_selected THEN
        -- Count remaining images for this menu item
        SELECT COUNT(*) INTO v_remaining_count
        FROM ai_generated_images 
        WHERE menu_item_id = v_menu_item_id;
        
        IF v_remaining_count > 0 THEN
            -- Get the oldest remaining image
            SELECT id INTO v_next_image_id
            FROM ai_generated_images 
            WHERE menu_item_id = v_menu_item_id
            ORDER BY created_at ASC
            LIMIT 1;

            -- Select the oldest remaining image
            UPDATE ai_generated_images 
            SET selected = true 
            WHERE id = v_next_image_id;
            
            -- Update menu item to reference the new selected image
            UPDATE menu_items 
            SET ai_image_id = v_next_image_id
            WHERE id = v_menu_item_id;
        ELSE
            -- No more AI images, clear the menu item reference
            UPDATE menu_items 
            SET 
                ai_image_id = NULL,
                image_source = CASE 
                    WHEN custom_image_url IS NOT NULL THEN 'custom'
                    ELSE 'none'
                END
            WHERE id = v_menu_item_id;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION select_ai_image_for_menu_item(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_menu_item_variations(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION select_custom_image_for_menu_item(UUID, VARCHAR(500)) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_all_images_from_menu_item(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_ai_generated_image(UUID) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION select_ai_image_for_menu_item(UUID, UUID) IS 'Atomically select an AI-generated image for a menu item, unselecting others';
COMMENT ON FUNCTION get_menu_item_variations(UUID) IS 'Get all AI-generated image variations for a menu item';
COMMENT ON FUNCTION select_custom_image_for_menu_item(UUID, VARCHAR(500)) IS 'Select a custom uploaded image for a menu item';
COMMENT ON FUNCTION remove_all_images_from_menu_item(UUID) IS 'Remove all image references from a menu item';
COMMENT ON FUNCTION delete_ai_generated_image(UUID) IS 'Delete an AI-generated image with proper cleanup of references';
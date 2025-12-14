-- AI Image Generation Feature Schema - Part 4: Helper Functions
-- Run this after Part 3

-- Function to select an AI-generated image for a menu item
CREATE OR REPLACE FUNCTION select_ai_image_for_menu_item(
    p_menu_item_id UUID,
    p_image_id UUID
)
RETURNS VOID 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
$$;

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
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION select_ai_image_for_menu_item(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_menu_item_variations(UUID) TO authenticated;
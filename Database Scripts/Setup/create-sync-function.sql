-- Create the missing sync function to sync menu_items table back to JSONB
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION sync_menu_items_to_jsonb(menu_id_param UUID)
RETURNS VOID AS $$
DECLARE
    items_json JSONB;
BEGIN
    -- Build JSONB array from menu_items table
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id::text,
            'name', name,
            'description', description,
            'price', price,
            'category', category,
            'available', available,
            'order', order_index,
            'imageSource', image_source,
            'customImageUrl', custom_image_url,
            'aiImageId', ai_image_id::text
        ) ORDER BY order_index
    ) INTO items_json
    FROM menu_items 
    WHERE menu_id = menu_id_param;
    
    -- Update menu_data with new items array
    UPDATE menus 
    SET 
        menu_data = jsonb_set(
            COALESCE(menu_data, '{}'),
            '{items}',
            COALESCE(items_json, '[]'::jsonb)
        ),
        updated_at = NOW()
    WHERE id = menu_id_param;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

SELECT 'Sync function created successfully!' as status;
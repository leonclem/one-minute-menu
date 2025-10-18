-- Fix for menu sync triggers to properly handle session replication role
-- This fixes the issue where items cannot be deleted completely

-- Function to sync FROM JSONB to menu_items when JSONB is updated
CREATE OR REPLACE FUNCTION sync_jsonb_to_menu_items()
RETURNS TRIGGER AS $$
DECLARE
    original_role TEXT;
BEGIN
    -- Save the current session replication role
    SELECT current_setting('session_replication_role', true) INTO original_role;
    
    -- DISABLE triggers temporarily to prevent infinite loop
    PERFORM set_config('session_replication_role', 'replica', true);
    
    -- Delete existing items for this menu
    DELETE FROM menu_items WHERE menu_id = NEW.id;
    
    -- Insert items from JSONB
    IF NEW.menu_data ? 'items' AND jsonb_array_length(NEW.menu_data->'items') > 0 THEN
        INSERT INTO menu_items (
            id,
            menu_id,
            name,
            description,
            price,
            category,
            available,
            order_index,
            image_source,
            custom_image_url,
            ai_image_id,
            created_at,
            updated_at
        )
        SELECT 
            -- Handle both UUID and short string IDs
            CASE 
                WHEN value->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
                THEN (value->>'id')::uuid
                ELSE uuid_generate_v4()
            END,
            NEW.id,
            COALESCE(value->>'name', 'Unnamed Item'),
            NULLIF(trim(COALESCE(value->>'description', '')), ''),
            COALESCE((value->>'price')::decimal, 0),
            NULLIF(trim(COALESCE(value->>'category', '')), ''),
            COALESCE((value->>'available')::boolean, true),
            COALESCE((value->>'order')::integer, ordinality::integer - 1),
            COALESCE(value->>'imageSource', 'none'),
            value->>'customImageUrl',
            CASE 
                WHEN value->>'aiImageId' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN (value->>'aiImageId')::uuid
                ELSE NULL
            END,
            NOW(),
            NOW()
        FROM jsonb_array_elements(NEW.menu_data->'items') WITH ORDINALITY;
    END IF;
    
    -- RESTORE the original session replication role
    PERFORM set_config('session_replication_role', COALESCE(original_role, 'origin'), true);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to keep JSONB in sync when menu_items change
CREATE OR REPLACE FUNCTION sync_menu_item_changes()
RETURNS TRIGGER AS $$
DECLARE
    target_menu_id UUID;
    items_json JSONB;
    original_role TEXT;
BEGIN
    -- Get the menu_id
    target_menu_id := CASE 
        WHEN TG_OP = 'DELETE' THEN OLD.menu_id
        ELSE NEW.menu_id
    END;
    
    -- Build JSONB array from menu_items (inline to avoid recursion)
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
    WHERE menu_id = target_menu_id;
    
    -- Save the current session replication role
    SELECT current_setting('session_replication_role', true) INTO original_role;
    
    -- DISABLE triggers temporarily to prevent infinite loop
    PERFORM set_config('session_replication_role', 'replica', true);
    
    -- Update menu_data with new items array
    UPDATE menus 
    SET 
        menu_data = jsonb_set(
            COALESCE(menu_data, '{}'),
            '{items}',
            COALESCE(items_json, '[]'::jsonb)
        ),
        updated_at = NOW()
    WHERE id = target_menu_id;
    
    -- RESTORE the original session replication role
    PERFORM set_config('session_replication_role', COALESCE(original_role, 'origin'), true);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

SELECT 'Menu sync triggers fixed - session replication role now properly managed' as status;

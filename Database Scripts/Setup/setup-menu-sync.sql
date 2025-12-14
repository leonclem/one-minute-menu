-- Setup bidirectional sync between menu_items table and menus.menu_data JSONB
-- This ensures the existing app continues to work while using the new table structure

-- Function to sync menu_items back to JSONB (for backward compatibility)
CREATE OR REPLACE FUNCTION sync_menu_items_to_jsonb(menu_id_param UUID)
RETURNS VOID AS $$
DECLARE
    items_json JSONB;
BEGIN
    -- Build JSONB array from menu_items
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
$$ LANGUAGE plpgsql;

-- Function to sync FROM JSONB to menu_items when JSONB is updated
CREATE OR REPLACE FUNCTION sync_jsonb_to_menu_items()
RETURNS TRIGGER AS $$
BEGIN
    -- DISABLE triggers temporarily to prevent infinite loop
    SET session_replication_role = replica;
    
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
            created_at,
            updated_at
        )
        SELECT 
            COALESCE((value->>'id')::uuid, uuid_generate_v4()),
            NEW.id,
            COALESCE(value->>'name', 'Unnamed Item'),
            NULLIF(trim(COALESCE(value->>'description', '')), ''),
            COALESCE((value->>'price')::decimal, 0),
            NULLIF(trim(COALESCE(value->>'category', '')), ''),
            COALESCE((value->>'available')::boolean, true),
            COALESCE((value->>'order')::integer, ordinality::integer),
            COALESCE(value->>'imageSource', 'none'),
            value->>'customImageUrl',
            NOW(),
            NOW()
        FROM jsonb_array_elements(NEW.menu_data->'items') WITH ORDINALITY;
    END IF;
    
    -- RE-ENABLE triggers
    SET session_replication_role = DEFAULT;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to keep JSONB in sync when menu_items change
CREATE OR REPLACE FUNCTION sync_menu_item_changes()
RETURNS TRIGGER AS $$
DECLARE
    target_menu_id UUID;
    items_json JSONB;
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
    
    -- DISABLE triggers temporarily to prevent infinite loop
    SET session_replication_role = replica;
    
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
    
    -- RE-ENABLE triggers
    SET session_replication_role = DEFAULT;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS sync_menu_items_insert ON menu_items;
DROP TRIGGER IF EXISTS sync_menu_items_update ON menu_items;
DROP TRIGGER IF EXISTS sync_menu_items_delete ON menu_items;
DROP TRIGGER IF EXISTS sync_menus_to_items ON menus;

-- Triggers to keep JSONB in sync when menu_items change
CREATE TRIGGER sync_menu_items_insert
    AFTER INSERT ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_changes();

CREATE TRIGGER sync_menu_items_update
    AFTER UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_changes();

CREATE TRIGGER sync_menu_items_delete
    AFTER DELETE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_changes();

-- Trigger to keep menu_items in sync when JSONB changes
CREATE TRIGGER sync_menus_to_items
    AFTER UPDATE OF menu_data ON menus
    FOR EACH ROW 
    WHEN (OLD.menu_data IS DISTINCT FROM NEW.menu_data)
    EXECUTE FUNCTION sync_jsonb_to_menu_items();

-- Initial sync: Update JSONB from current menu_items
DO $$
DECLARE
    menu_record RECORD;
BEGIN
    FOR menu_record IN SELECT DISTINCT menu_id FROM menu_items LOOP
        PERFORM sync_menu_items_to_jsonb(menu_record.menu_id);
    END LOOP;
END $$;

SELECT 'Bidirectional sync setup complete!' as status;

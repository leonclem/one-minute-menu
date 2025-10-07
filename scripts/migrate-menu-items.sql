-- Data Migration Script: Extract menu items from JSONB to menu_items table
-- This script migrates existing menu data from the JSONB menu_data field to the new menu_items table
-- Run this after applying migration 010_ai_image_generation_schema.sql

-- Function to migrate menu items from JSONB to normalized table
CREATE OR REPLACE FUNCTION migrate_menu_items_from_jsonb()
RETURNS INTEGER AS $
DECLARE
    menu_record RECORD;
    item_record RECORD;
    item_count INTEGER := 0;
BEGIN
    -- Loop through all menus that have items in menu_data
    FOR menu_record IN 
        SELECT id, user_id, menu_data 
        FROM menus 
        WHERE menu_data ? 'items' 
        AND jsonb_array_length(menu_data->'items') > 0
    LOOP
        -- Extract each item from the JSONB array
        FOR item_record IN 
            SELECT 
                value->>'id' as item_id,
                value->>'name' as name,
                value->>'description' as description,
                COALESCE((value->>'price')::decimal, 0) as price,
                value->>'category' as category,
                COALESCE((value->>'available')::boolean, true) as available,
                COALESCE((value->>'order')::integer, row_number() OVER()) as order_index
            FROM jsonb_array_elements(menu_record.menu_data->'items') WITH ORDINALITY
        LOOP
            -- Insert into menu_items table if not already exists
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
                created_at,
                updated_at
            )
            VALUES (
                COALESCE(item_record.item_id::uuid, uuid_generate_v4()),
                menu_record.id,
                COALESCE(item_record.name, 'Unnamed Item'),
                NULLIF(trim(item_record.description), ''),
                item_record.price,
                NULLIF(trim(item_record.category), ''),
                item_record.available,
                item_record.order_index,
                'none',
                NOW(),
                NOW()
            )
            ON CONFLICT (id) DO NOTHING; -- Skip if already migrated
            
            item_count := item_count + 1;
        END LOOP;
    END LOOP;
    
    RETURN item_count;
END;
$ LANGUAGE plpgsql;

-- Function to sync menu_items back to JSONB (for backward compatibility)
CREATE OR REPLACE FUNCTION sync_menu_items_to_jsonb(menu_id_param UUID)
RETURNS VOID AS $
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
            'order', order_index
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
$ LANGUAGE plpgsql;

-- Function to keep JSONB in sync when menu_items change
CREATE OR REPLACE FUNCTION sync_menu_item_changes()
RETURNS TRIGGER AS $
BEGIN
    -- Sync the menu_data JSONB when menu_items are modified
    PERFORM sync_menu_items_to_jsonb(
        CASE 
            WHEN TG_OP = 'DELETE' THEN OLD.menu_id
            ELSE NEW.menu_id
        END
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$ LANGUAGE plpgsql;

-- Triggers to keep JSONB in sync (for backward compatibility)
CREATE TRIGGER sync_menu_items_insert
    AFTER INSERT ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_changes();

CREATE TRIGGER sync_menu_items_update
    AFTER UPDATE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_changes();

CREATE TRIGGER sync_menu_items_delete
    AFTER DELETE ON menu_items
    FOR EACH ROW EXECUTE FUNCTION sync_menu_item_changes();

-- Execute the migration
SELECT migrate_menu_items_from_jsonb() as migrated_items_count;

-- Verify migration results
SELECT 
    m.name as menu_name,
    COUNT(mi.id) as items_count,
    jsonb_array_length(m.menu_data->'items') as jsonb_items_count
FROM menus m
LEFT JOIN menu_items mi ON m.id = mi.menu_id
WHERE m.menu_data ? 'items'
GROUP BY m.id, m.name, m.menu_data
ORDER BY m.name;

-- Clean up migration function (optional)
-- DROP FUNCTION IF EXISTS migrate_menu_items_from_jsonb();

COMMENT ON FUNCTION sync_menu_items_to_jsonb(UUID) IS 'Syncs menu_items table back to JSONB for backward compatibility';
COMMENT ON FUNCTION sync_menu_item_changes() IS 'Trigger function to keep JSONB menu_data in sync with menu_items table';
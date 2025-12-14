-- Check if the item ID format is causing issues

-- 1. What's in the JSONB?
SELECT 
    id as menu_id,
    name as menu_name,
    jsonb_pretty(menu_data->'items') as items_in_jsonb
FROM menus 
WHERE id = 'ee6917db-8725-4b87-b698-1143263297b4';

-- 2. Try to manually insert the item into menu_items table
-- This will fail if there's an ID format issue
DO $$
DECLARE
    item_record RECORD;
BEGIN
    FOR item_record IN 
        SELECT 
            value->>'id' as item_id,
            value->>'name' as item_name
        FROM menus m
        CROSS JOIN jsonb_array_elements(m.menu_data->'items')
        WHERE m.id = 'ee6917db-8725-4b87-b698-1143263297b4'
    LOOP
        RAISE NOTICE 'Item ID: %, Name: %', item_record.item_id, item_record.item_name;
        
        -- Try to cast to UUID
        BEGIN
            RAISE NOTICE 'Attempting to cast % to UUID...', item_record.item_id;
            PERFORM item_record.item_id::uuid;
            RAISE NOTICE 'SUCCESS: ID is a valid UUID';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'FAILED: ID is NOT a valid UUID - Error: %', SQLERRM;
        END;
    END LOOP;
END $$;

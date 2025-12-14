-- Migration to fix existing menu items with short IDs
-- This converts short string IDs to UUIDs and syncs to menu_items table

DO $$
DECLARE
    menu_record RECORD;
    items_array JSONB;
    new_items_array JSONB := '[]'::jsonb;
    item JSONB;
    new_id UUID;
BEGIN
    -- Loop through all menus
    FOR menu_record IN 
        SELECT id, name, menu_data 
        FROM menus 
        WHERE menu_data ? 'items'
    LOOP
        RAISE NOTICE 'Processing menu: % (%)', menu_record.name, menu_record.id;
        
        items_array := menu_record.menu_data->'items';
        new_items_array := '[]'::jsonb;
        
        -- Loop through each item in the menu
        FOR item IN SELECT * FROM jsonb_array_elements(items_array)
        LOOP
            -- Check if ID is a UUID or short string
            IF item->>'id' ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
                -- Already a UUID, keep it
                new_items_array := new_items_array || jsonb_build_array(item);
                RAISE NOTICE '  Item "%" already has UUID: %', item->>'name', item->>'id';
            ELSE
                -- Short ID, generate new UUID
                new_id := uuid_generate_v4();
                RAISE NOTICE '  Converting item "%" from % to %', item->>'name', item->>'id', new_id;
                
                -- Replace the ID in the item
                item := jsonb_set(item, '{id}', to_jsonb(new_id::text));
                new_items_array := new_items_array || jsonb_build_array(item);
            END IF;
        END LOOP;
        
        -- Update the menu with new UUIDs
        UPDATE menus 
        SET menu_data = jsonb_set(menu_data, '{items}', new_items_array)
        WHERE id = menu_record.id;
        
        RAISE NOTICE 'Updated menu: %', menu_record.name;
    END LOOP;
    
    RAISE NOTICE 'Migration complete!';
END $$;

-- Now sync all menus to menu_items table
DO $$
DECLARE
    menu_id_var UUID;
BEGIN
    FOR menu_id_var IN SELECT id FROM menus WHERE menu_data ? 'items' LOOP
        PERFORM sync_menu_items_to_jsonb(menu_id_var);
    END LOOP;
END $$;

SELECT 'Short IDs converted to UUIDs and synced to menu_items table' as status;

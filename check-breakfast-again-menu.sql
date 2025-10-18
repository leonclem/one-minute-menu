-- Check the actual state of the "Breakfast Again" menu
SELECT 
    id,
    name,
    menu_data->'items' as items_jsonb,
    jsonb_array_length(menu_data->'items') as item_count,
    updated_at
FROM menus 
WHERE id = 'ee6917db-8725-4b87-b698-1143263297b4';

-- Check if there are any items in the menu_items table
SELECT * FROM menu_items 
WHERE menu_id = 'ee6917db-8725-4b87-b698-1143263297b4';

-- Check the current session replication role
SHOW session_replication_role;

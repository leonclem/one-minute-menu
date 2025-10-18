-- Debug: Check if triggers are actually firing

-- 1. Manually test the sync function
DO $$
BEGIN
    RAISE NOTICE 'Testing sync for menu: ee6917db-8725-4b87-b698-1143263297b4';
    PERFORM sync_menu_items_to_jsonb('ee6917db-8725-4b87-b698-1143263297b4'::uuid);
END $$;

-- 2. Check what's actually in the menu_data JSONB
SELECT 
    id,
    name,
    menu_data,
    menu_data->'items' as items_array,
    jsonb_typeof(menu_data->'items') as items_type,
    CASE 
        WHEN menu_data ? 'items' THEN 'has items key'
        ELSE 'NO items key'
    END as has_items_key
FROM menus 
WHERE id = 'ee6917db-8725-4b87-b698-1143263297b4';

-- 3. Try to manually sync from JSONB to table
-- First, let's see what would be inserted
SELECT 
    COALESCE((value->>'id')::uuid, uuid_generate_v4()) as id,
    'ee6917db-8725-4b87-b698-1143263297b4'::uuid as menu_id,
    COALESCE(value->>'name', 'Unnamed Item') as name,
    COALESCE((value->>'price')::decimal, 0) as price,
    value->>'category' as category,
    COALESCE((value->>'available')::boolean, true) as available,
    COALESCE((value->>'order')::integer, ordinality::integer) as order_index
FROM (
    SELECT menu_data->'items' as items_array 
    FROM menus 
    WHERE id = 'ee6917db-8725-4b87-b698-1143263297b4'
) m
CROSS JOIN LATERAL jsonb_array_elements(m.items_array) WITH ORDINALITY;

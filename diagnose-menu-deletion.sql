-- Diagnostic script to check menu deletion issue
-- Run this to see the current state of your menu and triggers

-- 1. Check if the triggers exist and their definitions
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table IN ('menus', 'menu_items')
ORDER BY event_object_table, trigger_name;

-- 2. Check the function definitions (look for SET vs PERFORM set_config)
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name IN ('sync_jsonb_to_menu_items', 'sync_menu_item_changes')
ORDER BY routine_name;

-- 3. Sample query to see if you have any menus with items
SELECT 
    m.id as menu_id,
    m.name as menu_name,
    jsonb_array_length(m.menu_data->'items') as items_in_jsonb,
    COUNT(mi.id) as items_in_table
FROM menus m
LEFT JOIN menu_items mi ON mi.menu_id = m.id
GROUP BY m.id, m.name, m.menu_data
LIMIT 5;

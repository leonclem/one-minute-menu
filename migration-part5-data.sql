-- Data Migration: Extract menu items from JSONB to menu_items table
-- Run this after all schema parts are complete

-- Simple data migration without complex functions
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
SELECT 
    uuid_generate_v4() as id,
    m.id as menu_id,
    COALESCE(item_data.value->>'name', 'Unnamed Item') as name,
    NULLIF(trim(COALESCE(item_data.value->>'description', '')), '') as description,
    COALESCE((item_data.value->>'price')::decimal, 0) as price,
    NULLIF(trim(COALESCE(item_data.value->>'category', '')), '') as category,
    COALESCE((item_data.value->>'available')::boolean, true) as available,
    COALESCE((item_data.value->>'order')::integer, item_data.ordinality::integer) as order_index,
    'none' as image_source,
    NOW() as created_at,
    NOW() as updated_at
FROM menus m
CROSS JOIN LATERAL jsonb_array_elements(m.menu_data->'items') WITH ORDINALITY AS item_data(value, ordinality)
WHERE m.menu_data ? 'items' 
  AND jsonb_array_length(m.menu_data->'items') > 0
ON CONFLICT (id) DO NOTHING;
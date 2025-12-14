-- Migration script to fix old-style item IDs (item_XXXXXXXXX) to proper UUIDs
-- This script updates all menu items that have the old ID format
--
-- Run this in your Supabase SQL Editor

-- Create a temporary function to migrate item IDs in a menu's JSON data
CREATE OR REPLACE FUNCTION migrate_menu_item_ids(menu_data JSONB)
RETURNS JSONB AS $$
DECLARE
  items JSONB;
  categories JSONB;
  new_items JSONB := '[]'::JSONB;
  new_categories JSONB;
  item JSONB;
  old_id TEXT;
  new_id UUID;
  id_map JSONB := '{}'::JSONB;
BEGIN
  -- Get items array
  items := menu_data->'items';
  
  -- If no items, return original
  IF items IS NULL THEN
    RETURN menu_data;
  END IF;
  
  -- Process each item
  FOR item IN SELECT * FROM jsonb_array_elements(items)
  LOOP
    old_id := item->>'id';
    
    -- Check if ID needs migration (starts with 'item_' or 'cat_')
    IF old_id LIKE 'item_%' OR old_id LIKE 'cat_%' THEN
      -- Generate new UUID
      new_id := gen_random_uuid();
      
      -- Store mapping
      id_map := id_map || jsonb_build_object(old_id, new_id::TEXT);
      
      -- Update item with new ID
      item := jsonb_set(item, '{id}', to_jsonb(new_id::TEXT));
    END IF;
    
    -- Add to new items array
    new_items := new_items || jsonb_build_array(item);
  END LOOP;
  
  -- Update menu_data with new items
  menu_data := jsonb_set(menu_data, '{items}', new_items);
  
  -- TODO: Also update categories if they exist
  -- For now, we'll handle categories in the application layer
  
  RETURN menu_data;
END;
$$ LANGUAGE plpgsql;

-- Update all menus that have old-style IDs
DO $$
DECLARE
  menu_record RECORD;
  old_data JSONB;
  new_data JSONB;
  items JSONB;
  has_old_ids BOOLEAN;
  updated_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting menu ID migration...';
  
  -- Loop through all menus
  FOR menu_record IN 
    SELECT id, name, menu_data 
    FROM menus 
    WHERE menu_data IS NOT NULL
  LOOP
    old_data := menu_record.menu_data;
    items := old_data->'items';
    has_old_ids := FALSE;
    
    -- Check if this menu has old-style IDs
    IF items IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(items) AS item
        WHERE (item->>'id') LIKE 'item_%' OR (item->>'id') LIKE 'cat_%'
      ) INTO has_old_ids;
    END IF;
    
    -- If has old IDs, migrate them
    IF has_old_ids THEN
      RAISE NOTICE 'Migrating menu: % (ID: %)', menu_record.name, menu_record.id;
      
      new_data := migrate_menu_item_ids(old_data);
      
      -- Update the menu
      UPDATE menus 
      SET 
        menu_data = new_data,
        updated_at = NOW()
      WHERE id = menu_record.id;
      
      updated_count := updated_count + 1;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Migration complete! Updated % menus', updated_count;
END $$;

-- Clean up the temporary function
DROP FUNCTION IF EXISTS migrate_menu_item_ids(JSONB);

-- Verify the migration
SELECT 
  COUNT(*) as total_menus,
  COUNT(CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM jsonb_array_elements(menu_data->'items') AS item
      WHERE (item->>'id') LIKE 'item_%' OR (item->>'id') LIKE 'cat_%'
    ) THEN 1 
  END) as menus_with_old_ids
FROM menus
WHERE menu_data IS NOT NULL;

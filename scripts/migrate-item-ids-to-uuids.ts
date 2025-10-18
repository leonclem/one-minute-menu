/**
 * One-time migration script to convert old-style item IDs (item_XXXXXXXXX) to proper UUIDs
 * 
 * This script:
 * 1. Fetches all menus from the database
 * 2. Identifies menus with old-style IDs
 * 3. Migrates those IDs to proper UUIDs
 * 4. Updates the menus in the database
 * 
 * Run with: npx tsx scripts/migrate-item-ids-to-uuids.ts
 */

import { createClient } from '@supabase/supabase-js'
import { migrateItemIdsToUUIDs } from '../src/lib/menu-data-migration'
import type { Menu } from '../src/types'

// Load environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables:')
  console.error('- NEXT_PUBLIC_SUPABASE_URL')
  console.error('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function migrateAllMenus() {
  console.log('Starting menu ID migration...\n')
  
  // Fetch all menus
  const { data: menus, error } = await supabase
    .from('menus')
    .select('*')
  
  if (error) {
    console.error('Error fetching menus:', error)
    process.exit(1)
  }
  
  console.log(`Found ${menus.length} menus to check\n`)
  
  let migratedCount = 0
  let skippedCount = 0
  let errorCount = 0
  
  for (const dbMenu of menus) {
    const menuData = dbMenu.menu_data || {}
    const items = menuData.items || []
    
    // Check if this menu has old-style IDs
    const hasOldIds = items.some((item: any) => 
      item.id && (item.id.startsWith('item_') || item.id.startsWith('cat_'))
    )
    
    if (!hasOldIds) {
      skippedCount++
      continue
    }
    
    console.log(`Migrating menu: ${dbMenu.name} (${dbMenu.id})`)
    console.log(`  Old IDs found: ${items.filter((i: any) => i.id?.startsWith('item_')).length}`)
    
    try {
      // Transform to Menu type
      const menu: Menu = {
        id: dbMenu.id,
        userId: dbMenu.user_id,
        name: dbMenu.name,
        slug: dbMenu.slug,
        items: items,
        categories: menuData.categories,
        theme: menuData.theme,
        version: dbMenu.current_version,
        status: dbMenu.status,
        publishedAt: dbMenu.published_at ? new Date(dbMenu.published_at) : undefined,
        imageUrl: dbMenu.image_url,
        paymentInfo: menuData.paymentInfo,
        extractionMetadata: menuData.extractionMetadata,
        auditTrail: [],
        createdAt: new Date(dbMenu.created_at),
        updatedAt: new Date(dbMenu.updated_at),
      }
      
      // Migrate IDs
      const migratedMenu = migrateItemIdsToUUIDs(menu)
      
      // Update in database
      const { error: updateError } = await supabase
        .from('menus')
        .update({
          menu_data: {
            items: migratedMenu.items,
            categories: migratedMenu.categories,
            theme: migratedMenu.theme,
            paymentInfo: migratedMenu.paymentInfo,
            extractionMetadata: migratedMenu.extractionMetadata,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbMenu.id)
      
      if (updateError) {
        console.error(`  ❌ Error updating menu: ${updateError.message}`)
        errorCount++
      } else {
        console.log(`  ✅ Successfully migrated ${migratedMenu.items.length} items`)
        migratedCount++
      }
    } catch (err) {
      console.error(`  ❌ Error processing menu:`, err)
      errorCount++
    }
    
    console.log('')
  }
  
  console.log('\n=== Migration Summary ===')
  console.log(`Total menus checked: ${menus.length}`)
  console.log(`Menus migrated: ${migratedCount}`)
  console.log(`Menus skipped (no old IDs): ${skippedCount}`)
  console.log(`Errors: ${errorCount}`)
  console.log('\nMigration complete!')
}

// Run the migration
migrateAllMenus().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

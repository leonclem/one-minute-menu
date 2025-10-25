#!/usr/bin/env tsx
// Set a menu's name
// Usage: npx tsx scripts/set-menu-name.ts <menuId> <name>

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@supabase/supabase-js'

async function main() {
  const [menuId, ...nameParts] = process.argv.slice(2)
  const name = nameParts.join(' ')
  
  if (!menuId || !name) {
    console.error('Usage: npx tsx scripts/set-menu-name.ts <menuId> <name>')
    console.error('Example: npx tsx scripts/set-menu-name.ts c4a712d7-b089-4830-b11f-243b415c7075 "Amazing Restaurant"')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, serviceKey)

  console.log(`Setting menu name...`)
  console.log(`  Menu ID: ${menuId}`)
  console.log(`  Name: ${name}`)

  const { data, error } = await admin
    .from('menus')
    .update({ name })
    .eq('id', menuId)
    .select()
    .single()

  if (error) {
    console.error('Error:', error.message)
    process.exit(1)
  }

  console.log('✅ Menu name updated successfully!')
  console.log(`  Menu: ${data.name}`)
  console.log(`  Slug: ${data.slug}`)
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})

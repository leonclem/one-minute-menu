#!/usr/bin/env tsx
// Clean up old template versions, keeping only the latest
// Usage: npx tsx scripts/cleanup-old-templates.ts <templateName>

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createClient } from '@supabase/supabase-js'

async function main() {
  const [templateName] = process.argv.slice(2)
  if (!templateName) {
    console.error('Usage: npx tsx scripts/cleanup-old-templates.ts <templateName>')
    console.error('Example: npx tsx scripts/cleanup-old-templates.ts kraft-sports')
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, serviceKey)

  console.log(`Cleaning up old versions of template: ${templateName}`)
  console.log('='.repeat(60))

  // Get all versions of this template
  const { data: templates, error } = await admin
    .from('menu_templates')
    .select('id, name, version, created_at')
    .eq('name', templateName)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching templates:', error)
    process.exit(1)
  }

  if (!templates || templates.length === 0) {
    console.log(`No templates found with name: ${templateName}`)
    process.exit(0)
  }

  console.log(`\nFound ${templates.length} version(s):`)
  templates.forEach((t, i) => {
    console.log(`  ${i + 1}. ${t.name}@${t.version} (${t.id}) - ${new Date(t.created_at).toLocaleString()}`)
  })

  if (templates.length === 1) {
    console.log('\nOnly one version exists, nothing to clean up.')
    process.exit(0)
  }

  // Keep the latest, delete the rest
  const [latest, ...oldVersions] = templates
  console.log(`\nKeeping latest: ${latest.name}@${latest.version}`)
  console.log(`Deleting ${oldVersions.length} old version(s)...`)

  for (const old of oldVersions) {
    console.log(`  Deleting ${old.name}@${old.version} (${old.id})...`)
    const { error: deleteError } = await admin
      .from('menu_templates')
      .delete()
      .eq('id', old.id)

    if (deleteError) {
      console.error(`    Error: ${deleteError.message}`)
    } else {
      console.log(`    ✅ Deleted`)
    }
  }

  console.log('\nDone!')
}

main().catch((err) => {
  console.error('Failed:', err)
  process.exit(1)
})

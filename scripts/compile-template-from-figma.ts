#!/usr/bin/env tsx
// Compile a template from a Figma file key
// Usage:
//   npx tsx scripts/compile-template-from-figma.ts <templateId> <version> <figmaFileKey>
//   # Optionally pass name/author/preview/thumbnail via env or flags later

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { templateCompiler } from '@/lib/templates/compiler'
import { createClient } from '@supabase/supabase-js'

async function main() {
  const [templateId, version, figmaFileKey] = process.argv.slice(2)
  if (!templateId || !version || !figmaFileKey) {
    console.error('Usage: npx tsx scripts/compile-template-from-figma.ts <templateId> <version> <figmaFileKey>')
    process.exit(1)
  }

  console.log('='.repeat(60))
  console.log(`Compile Template from Figma`)
  console.log('='.repeat(60))
  console.log(`Template ID: ${templateId}`)
  console.log(`Version:     ${version}`)
  console.log(`Figma Key:   ${figmaFileKey}`)

  const metadata = {
    id: templateId,
    name: templateId,
    description: '',
    author: 'CLI',
    version,
    previewImageUrl: `/templates/${templateId}/preview.svg`,
    // Prefer PNG for thumbnail (lighter); ensure file exists locally or in storage
    thumbnailUrl: `/templates/${templateId}/thumbnail.png`,
    figmaFileKey,
    pageFormat: 'A4' as const,
    orientation: 'portrait' as const,
    tags: [],
    isPremium: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const result = await templateCompiler.compile({
    figmaFileKey,
    templateId,
    version,
    metadata,
  })

  console.log('\nCompilation result:')
  console.log(`  Success: ${result.success}`)
  console.log(`  Artifact: ${result.artifactPath}`)

  // Show compiled CSS length and a small snippet using service client (works in CLI)
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const admin = createClient(url, serviceKey)
    const { data: row } = await admin
      .from('menu_templates')
      .select('config')
      .eq('name', templateId)
      .eq('version', version)
      .maybeSingle()
    const css: string = (row as any)?.config?.styles?.css || ''
    const cssLen = css.length
    console.log(`  Embedded CSS length: ${cssLen}`)
    if (cssLen > 0) {
      const head = css.slice(0, 240).replace(/\n/g, ' ')
      console.log(`  CSS head: ${head}${cssLen > 240 ? '…' : ''}`)
    }

    // Compiler report
    console.log('\nDerived report:')
    const fonts: string[] = ((row as any)?.config?.styles?.fonts) || []
    if (fonts.length) console.log(`  Fonts: ${fonts.join(', ')}`)
    const colors = (row as any)?.config?.styles?.colors || {}
    const colorKeys = Object.keys(colors)
    if (colorKeys.length) console.log(`  Colors roles: ${colorKeys.join(', ')}`)

    // Grid inference from CSS
    const catColsMatch = css.match(/\.categories-container\s*\{[^}]*grid-template-columns:\s*repeat\((\d+)/)
    const itemColsMatch = css.match(/\.category-items\s*\{[^}]*grid-template-columns:\s*repeat\((\d+)/)
    if (catColsMatch) console.log(`  Categories grid columns: ${catColsMatch[1]}`)
    if (itemColsMatch) console.log(`  Item grid columns: ${itemColsMatch[1]}`)

    // Background texture detection
    const hasPaper = /\.menu-container::before[^{]*\{[^}]*background-image:/m.test(css)
    console.log(`  Background texture: ${hasPaper ? 'yes' : 'no'}`)

    // Required bindings presence
    const bindings = (row as any)?.config?.bindings || {}
    const required = ['restaurantName','categoryName','categoryItems','itemName']
    const missing = required.filter((k) => !bindings[k])
    console.log(`  Bindings: ${missing.length === 0 ? 'all required present' : 'missing ' + missing.join(', ')}`)

    // Try to download parsed artifact for troubleshooting
    try {
      const { data: art } = await admin
        .storage
        .from('templates-compiled')
        .download(`${result.artifactPath}/template.json`)
      if (art) {
        const txt = await art.text()
        const parsed = JSON.parse(txt)
        const nodeName = parsed?.structure?.name
        console.log(`  Root frame: ${nodeName || '(unknown)'}`)
      }
    } catch {}
  } catch (e) {
    console.log('  (Could not load config to show CSS length)')
  }

  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Failed to compile:', err)
  process.exit(1)
})

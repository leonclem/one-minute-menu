#!/usr/bin/env tsx
// Validate a Figma file for required bindings and conventions
// Usage:
//   npx tsx scripts/validate-figma-template.ts <figmaFileKey>

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { TemplateParser } from '@/lib/templates/parser'
import { createFigmaClient } from '@/lib/templates/figma-client'

async function main() {
  const [figmaFileKey] = process.argv.slice(2)
  if (!figmaFileKey) {
    console.error('Usage: npx tsx scripts/validate-figma-template.ts <figmaFileKey>')
    process.exit(1)
  }

  const parser = new TemplateParser({ generateCSS: false, extractAssets: false, figmaClient: createFigmaClient() })

  console.log('='.repeat(60))
  console.log('Figma Template Validator')
  console.log('='.repeat(60))
  console.log(`File Key: ${figmaFileKey}`)

  try {
    // Fetch and parse
    const file = await createFigmaClient().getFile(figmaFileKey)
    const nodes = createFigmaClient().extractNodes(file.document)

    // Find root and bindings
    // @ts-expect-error access to private for CLI validation; replicate logic if needed
    const root = (parser as any).findTemplateRoot(nodes)
    if (!root) throw new Error('Could not find a template root frame. Name a frame "A4 Portrait" or "Template Root".')

    const bindings = await parser.extractBindingPoints([root])

    // Report
    const missing: string[] = []
    if (!bindings.restaurantName) missing.push('{{restaurant.name}}')
    if (!bindings.categoryName) missing.push('{{category.name}}')
    if (!bindings.categoryItems) missing.push('{{category.items}}')
    if (!bindings.itemName) missing.push('{{item.name}}')

    if (missing.length > 0) {
      console.log('\n❌ Missing required bindings:')
      missing.forEach(m => console.log('  - ' + m))
      process.exitCode = 2
    } else {
      console.log('\n✅ Required bindings found.')
    }

    // Optional bindings info
    const optionals = ['itemPrice','itemDescription','itemIcon','itemDietaryTags','itemAllergens','itemVariants'] as const
    const present = optionals.filter(k => (bindings as any)[k])
    if (present.length > 0) {
      console.log('\nOptional bindings present: ' + present.join(', '))
    } else {
      console.log('\nNo optional bindings detected.')
    }

    console.log('\nTip: Ensure consistent Auto Layout and avoid absolute positioning inside auto frames.')
    console.log('\nDone.')
  } catch (err: any) {
    console.error('\nValidation failed:', err?.message || err)
    process.exit(1)
  }
}

main()

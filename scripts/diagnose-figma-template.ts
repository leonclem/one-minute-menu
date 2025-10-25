#!/usr/bin/env tsx
// Diagnose Figma template structure and compare with rendered output
// Usage: npx tsx scripts/diagnose-figma-template.ts <figmaFileKey>

import { config as loadEnv } from 'dotenv'
loadEnv({ path: '.env.local' })
loadEnv()
import { createFigmaClient } from '@/lib/templates/figma-client'
import { TemplateParser } from '@/lib/templates/parser'
import * as fs from 'fs'

async function main() {
  const [figmaFileKey] = process.argv.slice(2)
  if (!figmaFileKey) {
    console.error('Usage: npx tsx scripts/diagnose-figma-template.ts <figmaFileKey>')
    process.exit(1)
  }

  console.log('='.repeat(80))
  console.log('Figma Template Diagnostic Tool')
  console.log('='.repeat(80))
  console.log(`File Key: ${figmaFileKey}\n`)

  const client = createFigmaClient()
  const parser = new TemplateParser({ figmaClient: client })

  try {
    // 1. Fetch raw Figma file
    console.log('📥 Fetching Figma file...')
    const fileData = await client.getFile(figmaFileKey)
    const nodes = client.extractNodes(fileData.document)
    
    // Save raw structure for inspection
    fs.writeFileSync(
      `figma-${figmaFileKey}-raw.json`,
      JSON.stringify(fileData, null, 2)
    )
    console.log(`✅ Saved raw Figma data to figma-${figmaFileKey}-raw.json\n`)

    // 2. Find root
    console.log('🔍 Analyzing structure...')
    // @ts-expect-error accessing private method for diagnostics
    const root = parser.findTemplateRoot(nodes)
    if (!root) {
      console.error('❌ No template root found')
      process.exit(1)
    }
    console.log(`✅ Root frame: "${root.name}"`)
    console.log(`   Type: ${root.type}`)
    console.log(`   Layout: ${root.layout?.layoutMode || 'none'}`)
    console.log(`   Children: ${root.children?.length || 0}\n`)

    // 3. Analyze hierarchy
    console.log('📊 Layer hierarchy:')
    const printTree = (node: any, depth = 0) => {
      const indent = '  '.repeat(depth)
      const layoutInfo = node.layout?.layoutMode ? ` [${node.layout.layoutMode}]` : ''
      const fillInfo = node.styles?.fills?.[0]?.type === 'SOLID' 
        ? ` (fill: ${JSON.stringify(node.styles.fills[0].color).slice(0, 30)})`
        : ''
      console.log(`${indent}├─ ${node.name}${layoutInfo}${fillInfo}`)
      
      if (node.children && depth < 3) {
        node.children.forEach((child: any) => printTree(child, depth + 1))
      } else if (node.children && node.children.length > 0) {
        console.log(`${indent}   └─ ... (${node.children.length} more children)`)
      }
    }
    printTree(root)
    console.log()

    // 4. Extract bindings
    console.log('🔗 Binding points:')
    const bindings = await parser.extractBindingPoints([root])
    Object.entries(bindings).forEach(([key, value]) => {
      if (key !== 'conditionalLayers') {
        console.log(`   ${key}: ${value}`)
      }
    })
    console.log()

    // 5. Parse and generate CSS
    console.log('🎨 Generating CSS...')
    const parsed = await parser.parseFigmaFile(figmaFileKey)
    
    fs.writeFileSync(
      `figma-${figmaFileKey}-parsed.json`,
      JSON.stringify(parsed, null, 2)
    )
    console.log(`✅ Saved parsed template to figma-${figmaFileKey}-parsed.json`)
    
    fs.writeFileSync(
      `figma-${figmaFileKey}-styles.css`,
      parsed.styles.css
    )
    console.log(`✅ Saved generated CSS to figma-${figmaFileKey}-styles.css`)
    console.log(`   CSS length: ${parsed.styles.css.length} chars`)
    console.log(`   Fonts detected: ${parsed.styles.fonts.join(', ') || 'none'}`)
    console.log()

    // 6. Analyze specific issues
    console.log('🔬 Issue analysis:')
    
    // Check for category styling
    const hasCategoryBg = /\.category\s*\{[^}]*background/.test(parsed.styles.css)
    console.log(`   Category background: ${hasCategoryBg ? '✅ present' : '❌ missing'}`)
    
    // Check for grid layout
    const hasGrid = /grid-template-columns/.test(parsed.styles.css)
    console.log(`   Grid layout: ${hasGrid ? '✅ present' : '❌ missing'}`)
    
    // Check for typography
    const hasTypography = /font-family|font-size|font-weight/.test(parsed.styles.css)
    console.log(`   Typography: ${hasTypography ? '✅ present' : '❌ missing'}`)
    
    // Check for banner styling
    const hasBanner = /section--/.test(parsed.styles.css)
    console.log(`   Banner/decor: ${hasBanner ? '✅ present' : '❌ missing'}`)
    
    console.log()
    console.log('💡 Recommendations:')
    console.log('   1. Compare figma-*-raw.json with preview.svg to identify missing elements')
    console.log('   2. Check figma-*-styles.css for CSS selector accuracy')
    console.log('   3. Verify layer names match binding patterns exactly')
    console.log('   4. Ensure Auto Layout is used consistently in Figma')
    
  } catch (err: any) {
    console.error('\n❌ Diagnostic failed:', err?.message || err)
    if (err.stack) console.error(err.stack)
    process.exit(1)
  }
}

main()

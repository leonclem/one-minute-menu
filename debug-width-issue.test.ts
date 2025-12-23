import { generateLayoutV2 } from './src/lib/templates/v2/layout-engine-v2'
import type { EngineMenuV2 } from './src/lib/templates/v2/engine-types-v2'

describe('Debug Width Issue', () => {
  it('should debug tile width calculations', async () => {
    // Simple test menu
    const testMenu: EngineMenuV2 = {
      id: "test-menu",
      name: "Test Menu",
      sections: [{
        id: "sec-1",
        name: "Test Section",
        sortOrder: 0,
        items: [{
          id: "item-1",
          name: "Test Item",
          description: "Test description",
          price: 10.99,
          imageUrl: null,
          sortOrder: 0,
          indicators: {
            dietary: [],
            allergens: [],
            spiceLevel: null
          }
        }]
      }],
      metadata: {
        currency: "£",
        venueName: "Test Restaurant",
        venueAddress: null,
        logoUrl: null
      }
    }

    try {
      const result = await generateLayoutV2({
        menu: testMenu,
        templateId: 'classic-cards-v2'
      })
      
      console.log('Generated layout successfully')
      console.log('Pages:', result.pages.length)
      
      for (const page of result.pages) {
        console.log(`\nPage ${page.pageIndex}:`)
        console.log('Regions:')
        for (const region of page.regions) {
          console.log(`  ${region.id}: width=${region.width}, height=${region.height}`)
        }
        
        console.log('Tiles:')
        for (const tile of page.tiles) {
          console.log(`  ${tile.id}: x=${tile.x}, y=${tile.y}, width=${tile.width}, height=${tile.height}, region=${tile.regionId}`)
          
          const region = page.regions.find(r => r.id === tile.regionId)
          if (region) {
            const rightEdge = tile.x + tile.width
            const bottomEdge = tile.y + tile.height
            console.log(`    Right edge: ${rightEdge} (region width: ${region.width})`)
            console.log(`    Bottom edge: ${bottomEdge} (region height: ${region.height})`)
            
            if (rightEdge > region.width) {
              console.log(`    ❌ TILE EXTENDS OUTSIDE REGION! ${rightEdge} > ${region.width}`)
            }
            if (bottomEdge > region.height) {
              console.log(`    ❌ TILE EXTENDS OUTSIDE REGION! ${bottomEdge} > ${region.height}`)
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error:', error.message)
      if (error.violations) {
        console.log('Violations:')
        for (const violation of error.violations) {
          console.log(`  ${violation.code}: ${violation.message}`)
        }
      }
      throw error
    }
  })
})
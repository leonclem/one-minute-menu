import { generateLayoutV2 } from './src/lib/templates/v2/layout-engine-v2'
import type { EngineMenuV2 } from './src/lib/templates/v2/engine-types-v2'

describe('Debug Failing Case', () => {
  it('should debug the specific failing case from property test', async () => {
    // This is the counterexample from the failing property test
    const failingMenu: EngineMenuV2 = {
      "id": "00000000-0000-1000-8000-000000000000",
      "name": "     ",
      "sections": [
        {
          "id": "00000000-0000-1000-8000-000000000000",
          "name": "   ",
          "sortOrder": 0,
          "items": [
            {
              "id": "00000000-0000-1000-8000-000000000000",
              "name": "   ",
              "description": null,
              "price": 1,
              "imageUrl": null,
              "sortOrder": 0,
              "indicators": {
                "dietary": [],
                "allergens": [],
                "spiceLevel": null
              }
            }
          ]
        },
        {
          "id": "00000000-0000-1000-8000-000000000000",
          "name": "   ",
          "sortOrder": 0,
          "items": [
            {
              "id": "00000000-0000-1000-8000-000000000000",
              "name": "   ",
              "description": null,
              "price": 1,
              "imageUrl": null,
              "sortOrder": 0,
              "indicators": {
                "dietary": [],
                "allergens": [],
                "spiceLevel": null
              }
            }
          ]
        }
      ],
      "metadata": {
        "currency": "£",
        "venueName": null,
        "venueAddress": null,
        "logoUrl": null
      }
    }

    try {
      const result = await generateLayoutV2({
        menu: failingMenu,
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
            
            if (rightEdge > region.width + 0.01) { // Small tolerance for floating point
              console.log(`    ❌ TILE EXTENDS OUTSIDE REGION! ${rightEdge} > ${region.width}`)
            }
            if (bottomEdge > region.height + 0.01) {
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
          if (violation.tile) {
            console.log(`    Tile: ${violation.tile.id} at (${violation.tile.x}, ${violation.tile.y}) size ${violation.tile.width}x${violation.tile.height}`)
          }
          if (violation.context) {
            console.log(`    Context:`, violation.context)
          }
        }
      }
      throw error
    }
  })
})
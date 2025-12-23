/**
 * Debug test to understand the height calculation issue
 */

import { generateLayoutV2 } from './src/lib/templates/v2/layout-engine-v2'

const testMenu = {
  "id": "00000000-0000-1000-8000-000000000000",
  "name": "     ",
  "sections": [
    {
      "id": "00000000-0000-1000-8000-000000000000",
      "name": "   ",
      "sortOrder": 0,
      "items": [
        {"id": "00000000-0000-1000-8000-000000000000", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000001", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000002", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000003", "name": "   ", "description": null, "price": 1, "imageUrl": "http://a.aa", "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000004", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000005", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000006", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000007", "name": "   ", "description": null, "price": 1, "imageUrl": "http://a.aa", "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}},
        {"id": "00000000-0000-1000-8000-000000000008", "name": "   ", "description": null, "price": 1, "imageUrl": "http://a.aa", "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}}
      ]
    },
    {
      "id": "00000000-0000-1000-8000-000000000001",
      "name": "   ",
      "sortOrder": 0,
      "items": [
        {"id": "00000000-0000-1000-8000-000000000009", "name": "   ", "description": null, "price": 1, "imageUrl": null, "sortOrder": 0, "indicators": {"dietary": [], "allergens": [], "spiceLevel": null}}
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

describe('Debug Height Issue', () => {
  it('should debug the height calculation problem', async () => {
    // Temporarily override NODE_ENV to avoid invariant validation
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    
    try {
      const result = await generateLayoutV2({
        menu: testMenu,
        templateId: 'classic-cards-v2',
        debug: false
      })

      console.log('Generated layout successfully')
      console.log('Number of pages:', result.pages.length)
      
      for (const page of result.pages) {
        console.log(`\nPage ${page.pageIndex}:`)
        const bodyRegion = page.regions.find(r => r.id === 'body')!
        console.log('Body region height:', bodyRegion.height)
        
        for (const tile of page.tiles) {
          const bottom = tile.y + tile.height
          if (bottom > bodyRegion.height) {
            console.log(`VIOLATION: Tile ${tile.id} extends outside region bounds`)
            console.log(`  Tile: y=${tile.y}, height=${tile.height}, bottom=${bottom}`)
            console.log(`  Region height: ${bodyRegion.height}`)
            console.log(`  Tile type: ${tile.type}`)
            console.log(`  Tile content:`, tile.content)
          }
        }
      }
    } finally {
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv
    }
  })
})
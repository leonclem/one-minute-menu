import { generateLayoutV2 } from './src/lib/templates/v2/layout-engine-v2'
import type { EngineMenuV2 } from './src/lib/templates/v2/engine-types-v2'

describe('Debug Simple Height', () => {
  it('should debug with fewer items to see the issue clearly', async () => {
    // Simplified menu with just enough items to cause the issue
    const failingMenu: EngineMenuV2 = {
      "id": "test-menu",
      "name": "Test Menu",
      "sections": [
        {
          "id": "sec-1",
          "name": "Section 1",
          "sortOrder": 0,
          "items": [
            {
              "id": "item-1",
              "name": "Item 1",
              "description": null,
              "price": 1,
              "imageUrl": null,
              "sortOrder": 0,
              "indicators": { "dietary": [], "allergens": [], "spiceLevel": null }
            },
            {
              "id": "item-2", 
              "name": "Item 2",
              "description": null,
              "price": 1,
              "imageUrl": null,
              "sortOrder": 1,
              "indicators": { "dietary": [], "allergens": [], "spiceLevel": null }
            },
            {
              "id": "item-3",
              "name": "Item 3", 
              "description": null,
              "price": 1,
              "imageUrl": "http://a.aa", // This will be ITEM_CARD (rowSpan=2)
              "sortOrder": 2,
              "indicators": { "dietary": [], "allergens": [], "spiceLevel": null }
            },
            {
              "id": "item-4",
              "name": "Item 4",
              "description": null,
              "price": 1,
              "imageUrl": null,
              "sortOrder": 3,
              "indicators": { "dietary": [], "allergens": [], "spiceLevel": null }
            }
          ]
        },
        {
          "id": "sec-2",
          "name": "Section 2",
          "sortOrder": 1,
          "items": [
            {
              "id": "item-5",
              "name": "Item 5",
              "description": null,
              "price": 1,
              "imageUrl": null,
              "sortOrder": 0,
              "indicators": { "dietary": [], "allergens": [], "spiceLevel": null }
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
        console.log('Body region height:', page.regions.find(r => r.id === 'body')?.height)
        
        console.log('Tiles:')
        for (const tile of page.tiles) {
          if (tile.regionId === 'body') {
            const bottomEdge = tile.y + tile.height
            console.log(`  ${tile.id}: y=${tile.y}, height=${tile.height}, bottom=${bottomEdge}`)
          }
        }
      }
    } catch (error: any) {
      console.error('Error:', error.message)
      throw error
    }
  })
})
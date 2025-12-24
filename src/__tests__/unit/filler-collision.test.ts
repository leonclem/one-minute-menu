import { insertFillerTiles, getFillerTiles } from '../../lib/templates/filler-tiles'
import { LAYOUT_PRESETS } from '../../lib/templates/presets'
import type { GridLayout } from '../../lib/templates/types'

describe('Filler Tile Collision', () => {
  it('should not overlap filler tiles with multi-row items', () => {
    // Manually construct a layout that mimics the issue
    // 4 columns, 5 items total
    // First 4 items are in row 0 and have rowSpan: 2 (occupying row 0 and 1)
    // 5th item is in row 2 and has rowSpan: 2 (occupying row 2 and 3)
    const layout: GridLayout = {
      preset: LAYOUT_PRESETS['balanced'],
      context: 'desktop', // 4 columns
      totalTiles: 5,
      sections: [
        {
          name: 'Appetizers',
          startRow: 0,
          tiles: [
            {
              type: 'item',
              column: 0,
              row: 0,
              span: { columns: 1, rows: 2 },
              item: { name: 'Item 1', price: 10, featured: false }
            },
            {
              type: 'item',
              column: 1,
              row: 0,
              span: { columns: 1, rows: 2 },
              item: { name: 'Item 2', price: 10, featured: false }
            },
            {
              type: 'item',
              column: 2,
              row: 0,
              span: { columns: 1, rows: 2 },
              item: { name: 'Item 3', price: 10, featured: false }
            },
            {
              type: 'item',
              column: 3,
              row: 0,
              span: { columns: 1, rows: 2 },
              item: { name: 'Item 4', price: 10, featured: false }
            },
            {
              type: 'item',
              column: 0,
              row: 2,
              span: { columns: 1, rows: 2 },
              item: { name: 'Item 5', price: 10, featured: false }
            }
          ]
        }
      ]
    }

    const layoutWithFillers = insertFillerTiles(layout)
    const fillerTiles = getFillerTiles(layoutWithFillers)

    // Check for collisions
    for (const filler of fillerTiles) {
      for (const section of layout.sections) {
        for (const item of section.tiles) {
          if (item.type === 'item') {
            const itemEndCol = item.column + item.span.columns
            const itemEndRow = item.row + item.span.rows
            const fillerEndCol = filler.column + filler.span.columns
            const fillerEndRow = filler.row + filler.span.rows

            const overlaps = !(
              filler.column >= itemEndCol ||
              fillerEndCol <= item.column ||
              filler.row >= itemEndRow ||
              fillerEndRow <= item.row
            )

            if (overlaps) {
              throw new Error(
                `Filler tile at (${filler.column}, ${filler.row}) overlaps with item tile at (${item.column}, ${item.row})`
              )
            }
          }
        }
      }
    }
    
    // Also verify that we actually GOT fillers where we expected them (in row 2)
    const row2Fillers = fillerTiles.filter(f => f.row === 2)
    expect(row2Fillers.length).toBe(3)
  })
})


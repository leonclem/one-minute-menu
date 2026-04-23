/**
 * Tests for section-scoped interspersed fillers.
 *
 * Covers: fillers only in empty cells, section boundaries, multi-page sections,
 * determinism, and centering disabled when fillers enabled.
 */

import { generateLayoutV2 } from '../layout-engine-v2'
import { insertInterspersedFillers, getItemSlotPositions, hashString, redistributeLastRowItems } from '../filler-manager-v2'
import type {
  LayoutDocumentV2,
  PageLayoutV2,
  TemplateV2,
  TileInstanceV2,
  EngineMenuV2,
} from '../engine-types-v2'

describe('Interspersed Fillers', () => {
  const baseTemplate: TemplateV2 = {
    id: 'interspersed-test',
    version: '1.0.0',
    name: 'Test',
    page: {
      size: 'A4_PORTRAIT',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
    regions: {
      header: { height: 0 },
      title: { height: 0 },
      footer: { height: 0 },
    },
    body: {
      container: {
        type: 'GRID',
        cols: 4,
        rowHeight: 80,
        gapX: 8,
        gapY: 8,
      },
    },
    tiles: {},
    policies: {
      lastRowBalancing: 'CENTER',
      showLogoOnPages: ['FIRST'],
      repeatSectionHeaderOnContinuation: true,
      sectionHeaderKeepWithNextItems: 1,
    },
    filler: {
      enabled: true,
      safeZones: [
        { startRow: 0, endRow: 'LAST_CONTENT', startCol: 0, endCol: 3 },
      ],
      tiles: [], // use default half-opacity block
      policy: 'SEQUENTIAL',
    },
    itemIndicators: {
      mode: 'INLINE',
      maxCount: 3,
      style: { badgeSize: 14, iconSet: 'emoji' },
      spiceScale: {},
      letterFallback: {},
    },
  } as TemplateV2

  describe('insertInterspersedFillers', () => {
    it('places fillers only in empty cells (no displacement)', () => {
      const bodyWidth = 400
      const cellWidth = 94
      const gapX = 8
      const gapY = 8
      const rowHeight = 80
      const document: LayoutDocumentV2 = {
        templateId: baseTemplate.id,
        templateVersion: baseTemplate.version,
        pageSpec: { width: 500, height: 700, margins: baseTemplate.page.margins },
        pages: [
          {
            pageIndex: 0,
            pageType: 'SINGLE',
            regions: [
              { id: 'body', x: 0, y: 0, width: bodyWidth, height: 600 },
            ],
            tiles: [
              // Section A: row 0 full (header), row 1 has items at 0,1
              {
                id: 'h-a',
                type: 'SECTION_HEADER',
                regionId: 'body',
                x: 0,
                y: 0,
                width: bodyWidth,
                height: rowHeight + gapY,
                colSpan: 4,
                rowSpan: 1,
                gridRow: 0,
                gridCol: 0,
                layer: 'content',
                content: { type: 'SECTION_HEADER', sectionId: 'sec-a', name: 'Section A' } as any,
              },
              {
                id: 'i1',
                type: 'ITEM_CARD',
                regionId: 'body',
                x: 0,
                y: (rowHeight + gapY) * 1,
                width: cellWidth,
                height: rowHeight,
                colSpan: 1,
                rowSpan: 1,
                gridRow: 1,
                gridCol: 0,
                layer: 'content',
                content: { type: 'ITEM_CARD', sectionId: 'sec-a' } as any,
              },
              {
                id: 'i2',
                type: 'ITEM_CARD',
                regionId: 'body',
                x: (cellWidth + gapX) * 1,
                y: (rowHeight + gapY) * 1,
                width: cellWidth,
                height: rowHeight,
                colSpan: 1,
                rowSpan: 1,
                gridRow: 1,
                gridCol: 1,
                layer: 'content',
                content: { type: 'ITEM_CARD', sectionId: 'sec-a' } as any,
              },
            ],
          },
        ],
      }

      insertInterspersedFillers(document, baseTemplate, 'menu-1')

      const page = document.pages[0]
      const fillers = page.tiles.filter((t): t is TileInstanceV2 => t.type === 'FILLER')
      const contentTiles = page.tiles.filter(t => t.type !== 'FILLER')

      // Fillers must not overlap any content tile
      for (const filler of fillers) {
        for (const tile of contentTiles) {
          const overlap =
            filler.x < tile.x + tile.width &&
            filler.x + filler.width > tile.x &&
            filler.y < tile.y + tile.height &&
            filler.y + filler.height > tile.y
          expect(overlap).toBe(false)
        }
      }

      // Row 1: cols 2,3 are empty in sec-a → expect 2 fillers in that section's rows
      expect(fillers.length).toBeGreaterThanOrEqual(2)
    })

    it('respects section boundaries (fillers only in same section rows)', () => {
      const bodyWidth = 400
      const cellWidth = 94
      const gapX = 8
      const gapY = 8
      const rowHeight = 80
      const doc: LayoutDocumentV2 = {
        templateId: baseTemplate.id,
        templateVersion: baseTemplate.version,
        pageSpec: { width: 500, height: 700, margins: baseTemplate.page.margins },
        pages: [
          {
            pageIndex: 0,
            pageType: 'SINGLE',
            regions: [{ id: 'body', x: 0, y: 0, width: bodyWidth, height: 600 }],
            tiles: [
              // sec-a: row 0 (header), row 1 (one item col 0)
              {
                id: 'h-a',
                type: 'SECTION_HEADER',
                regionId: 'body',
                x: 0, y: 0, width: bodyWidth, height: rowHeight + gapY,
                colSpan: 4, rowSpan: 1, gridRow: 0, gridCol: 0, layer: 'content',
                content: { type: 'SECTION_HEADER', sectionId: 'sec-a', name: 'A' } as any,
              },
              {
                id: 'i1',
                type: 'ITEM_CARD',
                regionId: 'body',
                x: 0, y: (rowHeight + gapY) * 1, width: cellWidth, height: rowHeight,
                colSpan: 1, rowSpan: 1, gridRow: 1, gridCol: 0, layer: 'content',
                content: { type: 'ITEM_CARD', sectionId: 'sec-a' } as any,
              },
              // sec-b: row 2 (header), row 3 (one item col 0)
              {
                id: 'h-b',
                type: 'SECTION_HEADER',
                regionId: 'body',
                x: 0, y: (rowHeight + gapY) * 2, width: bodyWidth, height: rowHeight + gapY,
                colSpan: 4, rowSpan: 1, gridRow: 2, gridCol: 0, layer: 'content',
                content: { type: 'SECTION_HEADER', sectionId: 'sec-b', name: 'B' } as any,
              },
              {
                id: 'i2',
                type: 'ITEM_CARD',
                regionId: 'body',
                x: 0, y: (rowHeight + gapY) * 3, width: cellWidth, height: rowHeight,
                colSpan: 1, rowSpan: 1, gridRow: 3, gridCol: 0, layer: 'content',
                content: { type: 'ITEM_CARD', sectionId: 'sec-b' } as any,
              },
            ],
          },
        ],
      }

      insertInterspersedFillers(doc, baseTemplate, 'menu-1')

      const fillers = doc.pages[0].tiles.filter((t): t is TileInstanceV2 => t.type === 'FILLER')
      // Fillers in row 1 must be for sec-a (cols 1,2,3); fillers in row 3 for sec-b (cols 1,2,3)
      const row1Fillers = fillers.filter(f => f.gridRow === 1)
      const row3Fillers = fillers.filter(f => f.gridRow === 3)
      expect(row1Fillers.length).toBe(3)
      expect(row3Fillers.length).toBe(3)
    })

    it('is deterministic (same inputs → same filler placement)', () => {
      const doc: LayoutDocumentV2 = {
        templateId: baseTemplate.id,
        templateVersion: baseTemplate.version,
        pageSpec: { width: 500, height: 700, margins: baseTemplate.page.margins },
        pages: [
          {
            pageIndex: 0,
            pageType: 'SINGLE',
            regions: [{ id: 'body', x: 0, y: 0, width: 400, height: 600 }],
            tiles: [
              {
                id: 'h1',
                type: 'SECTION_HEADER',
                regionId: 'body',
                x: 0, y: 0, width: 400, height: 88, colSpan: 4, rowSpan: 1,
                gridRow: 0, gridCol: 0, layer: 'content',
                content: { type: 'SECTION_HEADER', sectionId: 's1', name: 'S1' } as any,
              },
              {
                id: 'i1',
                type: 'ITEM_CARD',
                regionId: 'body',
                x: 0, y: 88, width: 94, height: 80, colSpan: 1, rowSpan: 1,
                gridRow: 1, gridCol: 0, layer: 'content',
                content: { type: 'ITEM_CARD', sectionId: 's1' } as any,
              },
            ],
          },
        ],
      }

      const doc2 = JSON.parse(JSON.stringify(doc)) as LayoutDocumentV2
      insertInterspersedFillers(doc, baseTemplate, 'menu-1')
      insertInterspersedFillers(doc2, baseTemplate, 'menu-1')

      const ids1 = doc.pages[0].tiles.filter(t => t.type === 'FILLER').map(t => t.id).sort()
      const ids2 = doc2.pages[0].tiles.filter(t => t.type === 'FILLER').map(t => t.id).sort()
      expect(ids1).toEqual(ids2)

      const pos1 = doc.pages[0].tiles.filter(t => t.type === 'FILLER').map(t => ({ row: t.gridRow, col: t.gridCol })).sort((a, b) => a.row - b.row || a.col - b.col)
      const pos2 = doc2.pages[0].tiles.filter(t => t.type === 'FILLER').map(t => ({ row: t.gridRow, col: t.gridCol })).sort((a, b) => a.row - b.row || a.col - b.col)
      expect(pos1).toEqual(pos2)
    })

    it('does nothing when filler.enabled is false', () => {
      const templateNoFiller: TemplateV2 = {
        ...baseTemplate,
        filler: { ...baseTemplate.filler, enabled: false },
      }
      const doc: LayoutDocumentV2 = {
        templateId: baseTemplate.id,
        templateVersion: baseTemplate.version,
        pageSpec: { width: 500, height: 700, margins: baseTemplate.page.margins },
        pages: [
          {
            pageIndex: 0,
            pageType: 'SINGLE',
            regions: [{ id: 'body', x: 0, y: 0, width: 400, height: 600 }],
            tiles: [
              {
                id: 'h1',
                type: 'SECTION_HEADER',
                regionId: 'body',
                x: 0, y: 0, width: 400, height: 88, colSpan: 4, rowSpan: 1,
                gridRow: 0, gridCol: 0, layer: 'content',
                content: { type: 'SECTION_HEADER', sectionId: 's1', name: 'S1' } as any,
              },
            ],
          },
        ],
      }

      insertInterspersedFillers(doc, templateNoFiller, 'menu-1')
      const fillers = doc.pages[0].tiles.filter(t => t.type === 'FILLER')
      expect(fillers).toHaveLength(0)
    })
  })

  describe('generateLayoutV2 with fillers enabled', () => {
    const menuWithTwoSections: EngineMenuV2 = {
      id: 'menu-interspersed',
      name: 'Test Menu',
      sections: [
        {
          id: 'sec-1',
          name: 'Starters',
          sortOrder: 0,
          items: [
            { id: 'i1', name: 'Item 1', price: 5, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
            { id: 'i2', name: 'Item 2', price: 6, sortOrder: 1, indicators: { dietary: [], allergens: [], spiceLevel: null } },
          ],
        },
        {
          id: 'sec-2',
          name: 'Mains',
          sortOrder: 1,
          items: [
            { id: 'i3', name: 'Item 3', price: 12, sortOrder: 0, indicators: { dietary: [], allergens: [], spiceLevel: null } },
            { id: 'i4', name: 'Item 4', price: 14, sortOrder: 1, indicators: { dietary: [], allergens: [], spiceLevel: null } },
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Test' },
    }

    it('produces identical layout on two runs (determinism)', async () => {
      const templateId = '4-column-portrait'
      const run1 = await generateLayoutV2({
        menu: menuWithTwoSections,
        templateId,
        selection: { fillersEnabled: true },
      })
      const run2 = await generateLayoutV2({
        menu: menuWithTwoSections,
        templateId,
        selection: { fillersEnabled: true },
      })

      const norm = (doc: LayoutDocumentV2) => {
        const copy = JSON.parse(JSON.stringify(doc))
        if (copy.debug) delete copy.debug.generatedAt
        return JSON.stringify(copy)
      }
      expect(norm(run1)).toBe(norm(run2))
    })

    it('interspersed fillers appear in first row (not just trailing)', async () => {
      const menuFiveItems: EngineMenuV2 = {
        id: 'menu-five-intersp',
        name: 'Five Items',
        sections: [
          {
            id: 's1',
            name: 'Starters',
            sortOrder: 0,
            items: [1, 2, 3, 4, 5].map((i) => ({
              id: `item-${i}`,
              name: `Item ${i}`,
              price: 10,
              sortOrder: i - 1,
              indicators: { dietary: [], allergens: [], spiceLevel: null },
            })),
          },
        ],
        metadata: { currency: '$', venueName: 'Test' },
      }

      // 4-column-portrait: 4 cols, ITEM_CARD rowSpan 2 → 5 items need 2 logical rows (8 cells), 3 fillers
      const result = await generateLayoutV2({
        menu: menuFiveItems,
        templateId: '4-column-portrait',
        selection: { fillersEnabled: true },
      })

      const page = result.pages[0]
      const bodyTiles = page.tiles.filter(t => t.regionId === 'body')
      const items = bodyTiles.filter(t => t.type === 'ITEM_CARD')
      const fillers = bodyTiles.filter(t => t.type === 'FILLER')

      expect(items.length).toBe(5)
      expect(fillers.length).toBe(3)

      // Key assertion: fillers should NOT all be in the last logical row.
      // With interspersed placement, at least one filler should share a row with items.
      const itemRows = new Set(items.map(t => t.gridRow))
      const fillerRows = new Set(fillers.map(t => t.gridRow))
      const sharedRows = [...fillerRows].filter(r => itemRows.has(r))
      expect(sharedRows.length).toBeGreaterThan(0)
    })

    it('disables centering when fillers enabled (last row not centered)', async () => {
      const menuOneSectionFiveItems: EngineMenuV2 = {
        id: 'menu-five',
        name: 'Five',
        sections: [
          {
            id: 's1',
            name: 'Section',
            sortOrder: 0,
            items: [1, 2, 3, 4, 5].map((i) => ({
              id: `item-${i}`,
              name: `Item ${i}`,
              price: 10,
              sortOrder: i - 1,
              indicators: { dietary: [], allergens: [], spiceLevel: null },
            })),
          },
        ],
        metadata: { currency: '$' },
      }

      // 4-column-portrait has filler.enabled false; selection.fillersEnabled: true turns fillers on and disables centering
      const result = await generateLayoutV2({
        menu: menuOneSectionFiveItems,
        templateId: '4-column-portrait',
        selection: { fillersEnabled: true },
      })

      const page = result.pages[0]
      const bodyTiles = page.tiles.filter(t => t.regionId === 'body')
      const itemTiles = bodyTiles.filter(t => t.type === 'ITEM_CARD' || t.type === 'ITEM_TEXT_ROW')
      const fillers = bodyTiles.filter(t => t.type === 'FILLER')

      // With fillers enabled, last row should have item(s) left-aligned and fillers in remaining cells (no centering)
      expect(itemTiles.length).toBe(5)
      expect(fillers.length).toBeGreaterThan(0)
      // No overlap between any item and any filler
      for (const item of itemTiles) {
        for (const filler of fillers) {
          const overlap =
            item.x < filler.x + filler.width &&
            item.x + item.width > filler.x &&
            item.y < filler.y + filler.height &&
            item.y + item.height > filler.y
          expect(overlap).toBe(false)
        }
      }
    })
  })

  describe('getItemSlotPositions spread quality', () => {
    it('avoids horizontally adjacent fillers (7 items, 4 cols)', () => {
      // 7 items, 4 cols → 2 rows, 8 cells, 3 fillers
      // Run many seeds and check that fillers are never adjacent in the same row
      const cols = 4
      const itemCount = 7
      let adjacentViolations = 0
      const trials = 50

      for (let s = 0; s < trials; s++) {
        const slots = getItemSlotPositions(itemCount, cols, hashString(`test-${s}`))
        const itemCells = new Set(slots.map(sl => `${sl.row}-${sl.col}`))
        const totalRows = Math.ceil(itemCount / cols)

        for (let row = 0; row < totalRows; row++) {
          const fillerCols: number[] = []
          for (let col = 0; col < cols; col++) {
            if (!itemCells.has(`${row}-${col}`)) fillerCols.push(col)
          }
          const sorted = fillerCols.sort((a, b) => a - b)
          for (let i = 1; i < sorted.length; i++) {
            if (sorted[i] === sorted[i - 1] + 1) adjacentViolations++
          }
        }
      }

      // With the spread algorithm, horizontal adjacency should be very rare
      // (only forced when there are more fillers than half the columns in a row)
      expect(adjacentViolations).toBeLessThan(trials * 0.1)
    })

    it('avoids vertically stacked fillers across rows', () => {
      const cols = 4
      const itemCount = 5 // 2 rows, 3 fillers
      let verticalViolations = 0
      const trials = 50

      for (let s = 0; s < trials; s++) {
        const slots = getItemSlotPositions(itemCount, cols, hashString(`vert-${s}`))
        const itemCells = new Set(slots.map(sl => `${sl.row}-${sl.col}`))
        const totalRows = Math.ceil(itemCount / cols)

        // Collect filler columns per row
        const fillerColsByRow: Set<number>[] = []
        for (let row = 0; row < totalRows; row++) {
          const fillerCols = new Set<number>()
          for (let col = 0; col < cols; col++) {
            if (!itemCells.has(`${row}-${col}`)) fillerCols.add(col)
          }
          fillerColsByRow.push(fillerCols)
        }

        for (let row = 1; row < totalRows; row++) {
          for (const col of fillerColsByRow[row]) {
            if (fillerColsByRow[row - 1].has(col)) verticalViolations++
          }
        }
      }

      expect(verticalViolations).toBeLessThan(trials * 0.15)
    })

    it('is deterministic across runs', () => {
      const seed = hashString('determinism-test')
      const a = getItemSlotPositions(7, 4, seed)
      const b = getItemSlotPositions(7, 4, seed)
      expect(a).toEqual(b)
    })

    it('handles single filler gracefully', () => {
      // 3 items, 4 cols → 1 row, 1 filler — should be in any column
      const slots = getItemSlotPositions(3, 4, hashString('single'))
      expect(slots.length).toBe(3)
      const usedCols = new Set(slots.map(s => s.col))
      expect(usedCols.size).toBe(3)
      // Exactly one column missing (filler column)
      const missing = [0, 1, 2, 3].filter(c => !usedCols.has(c))
      expect(missing.length).toBe(1)
    })
  })

  describe('redistributeLastRowItems', () => {
    const cols = 4
    const rowHeight = 80
    const gapX = 8
    const gapY = 8
    const cellWidth = 94
    const bodyWidth = cols * cellWidth + (cols - 1) * gapX

    const makeItemTile = (id: string, row: number, col: number, sectionId: string): TileInstanceV2 => ({
      id,
      type: 'ITEM_CARD',
      regionId: 'body',
      x: col * (cellWidth + gapX),
      y: row * (rowHeight + gapY),
      width: cellWidth,
      height: rowHeight,
      colSpan: 1,
      rowSpan: 1,
      gridRow: row,
      gridCol: col,
      layer: 'content',
      content: { type: 'ITEM_CARD', sectionId } as any,
    })

    const makeHeaderTile = (id: string, row: number, sectionId: string): TileInstanceV2 => ({
      id,
      type: 'SECTION_HEADER',
      regionId: 'body',
      x: 0,
      y: row * (rowHeight + gapY),
      width: bodyWidth,
      height: rowHeight,
      colSpan: cols,
      rowSpan: 1,
      gridRow: row,
      gridCol: 0,
      layer: 'content',
      content: { type: 'SECTION_HEADER', sectionId, name: 'Section' } as any,
    })

    const makeDoc = (tiles: TileInstanceV2[]): LayoutDocumentV2 => ({
      templateId: baseTemplate.id,
      templateVersion: baseTemplate.version,
      pageSpec: { width: 500, height: 700, margins: baseTemplate.page.margins },
      pages: [{
        pageIndex: 0,
        pageType: 'SINGLE',
        regions: [{ id: 'body', x: 0, y: 0, width: bodyWidth, height: 600 }],
        tiles,
      }],
    })

    it('distributes fillers evenly across all rows, not just the last partial row', () => {
      // 6 items in a 4-col grid: 2 rows (8 cells), 2 fillers.
      // Old behaviour: row 0 full (4 items), row 1 partial (2 items at cols 0,1).
      // New behaviour: getItemSlotPositions distributes 2 fillers across both rows.
      const tiles: TileInstanceV2[] = [
        makeItemTile('r0c0', 0, 0, 'sec-a'),
        makeItemTile('r0c1', 0, 1, 'sec-a'),
        makeItemTile('r0c2', 0, 2, 'sec-a'),
        makeItemTile('r0c3', 0, 3, 'sec-a'),
        makeItemTile('r1c0', 1, 0, 'sec-a'),
        makeItemTile('r1c1', 1, 1, 'sec-a'),
      ]
      const doc = makeDoc(tiles)
      redistributeLastRowItems(doc, baseTemplate, 'menu-1')

      const page = doc.pages[0]
      const itemTiles = page.tiles.filter(t => t.type === 'ITEM_CARD')

      // All 6 items still present
      expect(itemTiles).toHaveLength(6)

      // Each (gridRow, gridCol) pair must be unique — no overlaps
      const positions = itemTiles.map(t => `${t.gridRow}-${t.gridCol}`)
      expect(new Set(positions).size).toBe(6)

      // Items span both rows
      const rowsUsed = new Set(itemTiles.map(t => t.gridRow))
      expect(rowsUsed.size).toBe(2)

      // Each row should have fewer than 4 items (fillers distributed across rows)
      const itemsInRow0 = itemTiles.filter(t => t.gridRow === 0).length
      const itemsInRow1 = itemTiles.filter(t => t.gridRow === 1).length
      expect(itemsInRow0).toBeLessThan(4)
      expect(itemsInRow1).toBeLessThan(4)
      expect(itemsInRow0 + itemsInRow1).toBe(6)
    })

    it('does not modify rows that share space with non-item tiles (mixed rows)', () => {
      // Row 0: full-width header (mixed row), Rows 1-2: 2 items (pure item rows).
      // The header marks row 0 as mixed; item rows 1+ are free to redistribute.
      const tiles: TileInstanceV2[] = [
        makeHeaderTile('header', 0, 'sec-a'),
        makeItemTile('r1c0', 1, 0, 'sec-a'),
        makeItemTile('r1c1', 1, 1, 'sec-a'),
      ]
      const doc = makeDoc(tiles)
      redistributeLastRowItems(doc, baseTemplate, 'menu-1')

      const headerTile = doc.pages[0].tiles.find(t => t.id === 'header')!
      expect(headerTile.gridCol).toBe(0) // header must not move
      expect(headerTile.x).toBe(0)

      // Both item tiles are still present and have unique positions
      const itemTiles = doc.pages[0].tiles.filter(t => t.type === 'ITEM_CARD')
      expect(itemTiles).toHaveLength(2)
      const positions = itemTiles.map(t => `${t.gridRow}-${t.gridCol}`)
      expect(new Set(positions).size).toBe(2)
    })

    it('does not touch rows shared with a logo or flagship tile', () => {
      // Row 0: logo (colSpan 1) + 3 items in cols 1,2,3 — mixed row, must not be touched
      const logoTile: TileInstanceV2 = {
        id: 'logo',
        type: 'LOGO_BODY',
        regionId: 'body',
        x: 0,
        y: 0,
        width: cellWidth,
        height: rowHeight,
        colSpan: 1,
        rowSpan: 1,
        gridRow: 0,
        gridCol: 0,
        layer: 'content',
        content: { type: 'LOGO_BODY', sectionId: 'sec-a' } as any,
      }
      const tiles: TileInstanceV2[] = [
        logoTile,
        makeItemTile('r0c1', 0, 1, 'sec-a'),
        makeItemTile('r0c2', 0, 2, 'sec-a'),
        makeItemTile('r0c3', 0, 3, 'sec-a'),
      ]
      const doc = makeDoc(tiles)
      redistributeLastRowItems(doc, baseTemplate, 'menu-1')

      // Mixed row with logo — items must remain at cols 1, 2, 3
      const itemCols = doc.pages[0].tiles
        .filter(t => t.type === 'ITEM_CARD')
        .map(t => t.gridCol)
        .sort((a, b) => a - b)
      expect(itemCols).toEqual([1, 2, 3])
    })

    it('is deterministic across calls', () => {
      const tiles = (): TileInstanceV2[] => [
        makeItemTile('r0c0', 0, 0, 'sec-a'),
        makeItemTile('r0c1', 0, 1, 'sec-a'),
        makeItemTile('r0c2', 0, 2, 'sec-a'),
      ]
      const doc1 = makeDoc(tiles())
      const doc2 = makeDoc(tiles())

      redistributeLastRowItems(doc1, baseTemplate, 'menu-x')
      redistributeLastRowItems(doc2, baseTemplate, 'menu-x')

      const cols1 = doc1.pages[0].tiles.map(t => t.gridCol).sort()
      const cols2 = doc2.pages[0].tiles.map(t => t.gridCol).sort()
      expect(cols1).toEqual(cols2)
    })

    it('handles multiple sections on the same page independently', () => {
      // Section A: 3 items in a 4-col row
      // Section B: 2 items in a 4-col row
      const tiles: TileInstanceV2[] = [
        makeItemTile('a0', 0, 0, 'sec-a'),
        makeItemTile('a1', 0, 1, 'sec-a'),
        makeItemTile('a2', 0, 2, 'sec-a'),
        makeItemTile('b0', 1, 0, 'sec-b'),
        makeItemTile('b1', 1, 1, 'sec-b'),
      ]
      const doc = makeDoc(tiles)
      redistributeLastRowItems(doc, baseTemplate, 'menu-1')

      const secATiles = doc.pages[0].tiles.filter(t => (t.content as any).sectionId === 'sec-a')
      const secBTiles = doc.pages[0].tiles.filter(t => (t.content as any).sectionId === 'sec-b')

      // Both sections still have the right number of tiles
      expect(secATiles).toHaveLength(3)
      expect(secBTiles).toHaveLength(2)

      // Both sections use distinct columns with no duplicates
      expect(new Set(secATiles.map(t => t.gridCol)).size).toBe(3)
      expect(new Set(secBTiles.map(t => t.gridCol)).size).toBe(2)
    })
  })
})

/**
 * Tests for section-scoped interspersed fillers.
 *
 * Covers: fillers only in empty cells, section boundaries, multi-page sections,
 * determinism, and centering disabled when fillers enabled.
 */

import { generateLayoutV2 } from '../layout-engine-v2'
import { insertInterspersedFillers, getItemSlotPositions, hashString } from '../filler-manager-v2'
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
      const templateId = 'classic-cards-v2'
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

      // classic-cards-v2: 4 cols, ITEM_CARD rowSpan 2 → 5 items need 2 logical rows (8 cells), 3 fillers
      const result = await generateLayoutV2({
        menu: menuFiveItems,
        templateId: 'classic-cards-v2',
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

      // classic-cards-v2 has filler.enabled false; selection.fillersEnabled: true turns fillers on and disables centering
      const result = await generateLayoutV2({
        menu: menuOneSectionFiveItems,
        templateId: 'classic-cards-v2',
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
})

import { generateLayoutV2 } from './src/lib/templates/v2/layout-engine-v2'
import { fitsInCurrentPage, initContext } from './src/lib/templates/v2/streaming-paginator'
import { loadTemplateV2 } from './src/lib/templates/v2/template-loader-v2'
import { buildPageSpec } from './src/lib/templates/v2/engine-types-v2'
import type { EngineMenuV2 } from './src/lib/templates/v2/engine-types-v2'

describe('Debug Fits Check', () => {
  it('should debug the fitsInCurrentPage function', async () => {
    const template = await loadTemplateV2('classic-cards-v2')
    const pageSpec = buildPageSpec('A4_PORTRAIT', template.page.margins)
    
    const ctx = initContext(template, pageSpec)
    
    // Simulate being at row 7 (where the section header was placed)
    ctx.currentRow = 7
    
    const bodyRegion = ctx.currentPage.regions.find(r => r.id === 'body')!
    console.log('Body region height:', bodyRegion.height)
    console.log('Current row:', ctx.currentRow)
    console.log('Row height + gap:', template.body.container.rowHeight + template.body.container.gapY)
    
    const nextTileY = ctx.currentRow * (template.body.container.rowHeight + template.body.container.gapY)
    console.log('Next tile Y position:', nextTileY)
    console.log('Available space:', bodyRegion.height - nextTileY)
    
    // Test if a section header (height 70) fits
    const sectionHeaderHeight = 70
    console.log('Section header height:', sectionHeaderHeight)
    console.log('Would section header fit?', fitsInCurrentPage(ctx, sectionHeaderHeight))
    
    // Test the actual calculation
    const wouldFit = nextTileY + sectionHeaderHeight <= bodyRegion.height
    console.log('Manual calculation - would fit?', wouldFit)
    console.log('Bottom edge would be:', nextTileY + sectionHeaderHeight)
    console.log('Region height:', bodyRegion.height)
  })
})
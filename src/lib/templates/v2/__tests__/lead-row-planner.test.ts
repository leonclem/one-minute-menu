import type { EngineItemV2, EngineMenuV2, TemplateV2 } from '../engine-types-v2'
import { loadTemplateV2 } from '../template-loader-v2'
import {
  buildContinuationLeadRowPlan,
  buildSectionLeadRowPlan,
  buildSectionPlans,
} from '../lead-row-planner'

const baseIndicators = { dietary: [], allergens: [], spiceLevel: null as number | null }

function makeItem(id: string, sortOrder: number, overrides: Partial<EngineItemV2> = {}): EngineItemV2 {
  return {
    id,
    name: `Item ${id}`,
    description: `Description for ${id}`,
    price: 10 + sortOrder,
    imageUrl: `https://example.com/${id}.jpg`,
    sortOrder,
    indicators: baseIndicators,
    ...overrides,
  }
}

describe('lead row planner', () => {
  let template2: TemplateV2
  let template3: TemplateV2
  let template4: TemplateV2
  let template5: TemplateV2
  let template6: TemplateV2
  let template1: TemplateV2

  beforeAll(async () => {
    template1 = await loadTemplateV2('1-column-tall')
    template2 = await loadTemplateV2('2-column-portrait')
    template3 = await loadTemplateV2('3-column-portrait')
    template4 = await loadTemplateV2('4-column-portrait')
    template5 = await loadTemplateV2('5-column-landscape')
    template6 = await loadTemplateV2('6-column-portrait-a3')
  })

  it('assigns the embedded logo to the first non-empty section only', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-first-non-empty',
      name: 'Lead Plan Menu',
      sections: [
        { id: 'empty', name: 'Empty', sortOrder: 0, items: [] },
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 1,
          items: [makeItem('main-1', 0), makeItem('main-2', 1)],
        },
        {
          id: 'desserts',
          name: 'Desserts',
          sortOrder: 2,
          items: [makeItem('dessert-1', 0)],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plans = buildSectionPlans(menu, template4, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
    })

    const mainsLogo = plans[0].leadRow.candidates.find(candidate => candidate.kind === 'logo')
    const dessertsLogo = plans[1].leadRow.candidates.find(candidate => candidate.kind === 'logo')

    expect(plans.map(plan => plan.section.id)).toEqual(['mains', 'desserts'])
    expect(mainsLogo).toBeDefined()
    expect((mainsLogo?.tile.content as { sectionId?: string }).sectionId).toBe('mains')
    expect(dessertsLogo).toBeUndefined()
  })

  it('uses the 4-column preferred logo + header + flagship composition', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-four-col',
      name: 'Lead Plan Four Column',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true, isFeatured: true }),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template4, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    })

    expect(plan.widthRule.profile).toBe('4-column-portrait')
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo', 'header', 'flagship'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['item', 'item'])
  })

  it('keeps 1-column templates as sequential lead tiles with no shared row', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-one-col',
      name: 'Lead Plan One Column',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true, isFeatured: true }),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template1, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    })

    expect(plan.widthRule.profile).toBe('1-column-tall')
    expect(plan.widthRule.sharedLeadRowSupported).toBe(false)
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['header', 'flagship', 'item', 'item'])
    expect(plan.queuedTiles[1].tile.type).toBe('FLAGSHIP_CARD')
  })

  it('uses the 2-column fallback of logo + header before flagship', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-two-col',
      name: 'Lead Plan Two Column',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true, isFeatured: true }),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template2, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    })

    expect(plan.widthRule.profile).toBe('2-column-portrait')
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo', 'header'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['flagship', 'item', 'item'])
    expect(plan.queuedTiles[0].tile.type).toBe('FLAGSHIP_CARD')
  })

  it('does not place regular items ahead of a full-width header when body logo tile is enabled', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-two-col-standard-header',
      name: 'Lead Plan Two Column Standard Header',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('item-1', 0),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template4, {
      showLogoTile: true,
      showCategoryTitles: true,
      showCategoryHeaderTiles: false,
    })

    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['header', 'item', 'item', 'item'])
  })

  it('does not place flagship ahead of a full-width header when body logo tile is enabled', () => {
    // Reproduces the exact screenshot scenario: 4-column with showCategoryHeaderTiles=false
    // and showFlagshipTile=true. The flagship (colSpan=2) fits alongside the logo but must
    // NOT appear before the full-width section header.
    const menu: EngineMenuV2 = {
      id: 'lead-plan-four-col-flagship-standard-header',
      name: 'Lead Plan Four Column Flagship Standard Header',
      sections: [
        {
          id: 'sandwiches',
          name: 'Sandwiches',
          sortOrder: 0,
          items: [
            makeItem('bavarian', 0, { isFlagship: true, isFeatured: true }),
            makeItem('grilled', 1),
            makeItem('breaded', 2),
            makeItem('cordon', 3),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Cafe Vienna', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template4, {
      showLogoTile: true,
      showCategoryTitles: true,
      showCategoryHeaderTiles: false,
      showFlagshipTile: true,
    })

    // Only the logo should be in the lead row; header must come before flagship and items
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo'])
    expect(plan.queuedTiles[0].kind).toBe('header')
    expect(plan.queuedTiles[1].kind).toBe('flagship')
  })

  it('uses the 3-column fallback of logo + header + first item before flagship', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-three-col',
      name: 'Lead Plan Three Column',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true, isFeatured: true }),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template3, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    })

    expect(plan.widthRule.profile).toBe('3-column-portrait')
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo', 'header', 'item'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['flagship', 'item'])
    expect(plan.queuedTiles[0].tile.type).toBe('FLAGSHIP_CARD')
  })

  it('uses the 5-column composition of logo + header + flagship + first item', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-five-col',
      name: 'Lead Plan Five Column',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true, isFeatured: true }),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template5, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    })

    expect(plan.widthRule.profile).toBe('5-column-landscape')
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo', 'header', 'flagship', 'item'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['item'])
  })

  it('uses the 6-column composition of logo + header + flagship + first two items', () => {
    const menu: EngineMenuV2 = {
      id: 'lead-plan-six-col',
      name: 'Lead Plan Six Column',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true, isFeatured: true }),
            makeItem('item-2', 1),
            makeItem('item-3', 2),
            makeItem('item-4', 3),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue', logoUrl: 'https://example.com/logo.png' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template6, {
      showLogoTile: true,
      showCategoryHeaderTiles: true,
      showFlagshipTile: true,
    })

    expect(plan.widthRule.profile).toBe('6-column-portrait-a3')
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['logo', 'header', 'flagship', 'item', 'item'])
    expect(plan.queuedTiles.map(candidate => candidate.kind)).toEqual(['item'])
  })

  it('models continuation starts as header-only lead rows', () => {
    const section = {
      id: 'mains',
      name: 'Mains',
      sortOrder: 0,
      items: [makeItem('item-1', 0)],
    }

    const plan = buildContinuationLeadRowPlan(section, template1, {
      showCategoryHeaderTiles: true,
    })

    expect(plan.startKind).toBe('continuation')
    expect(plan.chosenTiles.map(candidate => candidate.kind)).toEqual(['header'])
    expect((plan.chosenTiles[0].tile.content as { isContinuation?: boolean }).isContinuation).toBe(true)
    expect(plan.queuedTiles).toEqual([])
  })

  it('displays flagship tile even when textOnly is true (image mode is none)', () => {
    const menu: EngineMenuV2 = {
      id: 'text-only-flagship',
      name: 'Text Only Menu',
      sections: [
        {
          id: 'mains',
          name: 'Mains',
          sortOrder: 0,
          items: [
            makeItem('flagship', 0, { isFlagship: true }),
            makeItem('item-2', 1),
          ],
        },
      ],
      metadata: { currency: '$', venueName: 'Planner Venue' },
    }

    const plan = buildSectionLeadRowPlan(menu, menu.sections[0], template4, {
      showFlagshipTile: true,
      showCategoryHeaderTiles: true,
      textOnly: true,
      imageMode: 'none',
    })

    const flagshipCandidate = plan.candidates.find(candidate => candidate.kind === 'flagship')
    expect(flagshipCandidate).toBeDefined()
    expect((flagshipCandidate?.tile.content as { showImage?: boolean }).showImage).toBe(false)
  })
})

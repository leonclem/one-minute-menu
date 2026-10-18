/**
 * @jest-environment node
 */

jest.mock('@/lib/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import {
  diagnoseRecommendedStackIds,
  sanitizeRecommendedStackIds,
  fallbackFinishingTouchStack,
  inferFinishingTouchFamilyFromText,
} from '../rank'
import {
  buildFinishingTouchesUserPrompt,
  recommendFinishingTouches,
} from '../recommend'

describe('sanitizeRecommendedStackIds', () => {
  it('keeps a massaman-like ranked prefix and drops unknown ids', () => {
    const stack = sanitizeRecommendedStackIds(
      ['coriander', 'lime_wedge', 'red_chilli', 'cashews', 'not-a-thing'],
      [],
    )
    expect(stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'cashews',
    ])
  })

  it('does not repeat coriander already on the dish', () => {
    const stack = sanitizeRecommendedStackIds(
      ['coriander', 'lime_wedge', 'red_chilli', 'cashews'],
      ['cilantro'],
    )
    expect(stack.map((item) => item.id)).toEqual(['lime_wedge', 'red_chilli', 'cashews'])
  })

  it('falls back to a generic stack when ranking is empty', () => {
    const stack = sanitizeRecommendedStackIds([], [])
    expect(stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })

  it('still returns a generic stack for an unknown dish with no existing garnishes', () => {
    expect(fallbackFinishingTouchStack([]).length).toBeGreaterThan(0)
  })

  it('reports every transformation without changing the final stack', () => {
    const diagnostics = diagnoseRecommendedStackIds(
      [
        'coriander',
        'not-a-thing',
        'lime_wedge',
        'red_chilli',
        'cashews',
        'parsley',
        'coriander',
      ],
      ['cilantro'],
    )

    expect(diagnostics.validIds).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'cashews',
      'parsley',
    ])
    expect(diagnostics.droppedUnknownIds).toEqual(['not-a-thing'])
    expect(diagnostics.droppedExistingIds).toEqual(['coriander'])
    expect(diagnostics.droppedOverflowIds).toEqual([])
    expect(diagnostics.fallbackUsed).toBe(false)
    expect(diagnostics.stack.map((item) => item.id)).toEqual([
      'lime_wedge',
      'red_chilli',
      'cashews',
      'parsley',
    ])
  })

  it('keeps a ranked list past four and drops ids past the suggestion limit', () => {
    const withinLimit = diagnoseRecommendedStackIds(
      ['coriander', 'lime_wedge', 'red_chilli', 'cashews', 'parsley'],
      [],
    )
    expect(withinLimit.droppedOverflowIds).toEqual([])
    expect(withinLimit.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'cashews',
      'parsley',
    ])

    const overflow = diagnoseRecommendedStackIds(
      [
        'coriander',
        'lime_wedge',
        'red_chilli',
        'cashews',
        'parsley',
        'basil',
        'mint',
        'spring_onion',
        'sesame_seeds',
        'microgreens',
        'lemon_wedge',
        'peanuts',
        'crispy_shallots',
      ],
      [],
    )
    expect(overflow.droppedOverflowIds).toEqual(['crispy_shallots'])
    expect(overflow.stack).toHaveLength(12)
  })

  it('reports an empty-response fallback', () => {
    const fallback = diagnoseRecommendedStackIds([], [])
    expect(fallback.fallbackUsed).toBe(true)
    expect(fallback.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })

  it('drops savoury ids when family is cake and uses the cake fallback if none remain', () => {
    const stack = sanitizeRecommendedStackIds(
      ['coriander', 'lime_wedge', 'red_chilli', 'cashews'],
      [],
      'cake',
    )
    expect(stack.map((item) => item.id)).toEqual([
      'fresh_berries',
      'powdered_sugar',
      'chocolate_shavings',
      'mint_sprig',
    ])
  })

  it('keeps ranked cake ids without appending the rest of the cake catalogue', () => {
    const stack = sanitizeRecommendedStackIds(
      ['fresh_berries', 'powdered_sugar', 'chocolate_drizzle', 'cream_swirl'],
      [],
      'cake',
    )
    expect(stack.map((item) => item.id)).toEqual([
      'fresh_berries',
      'powdered_sugar',
      'chocolate_drizzle',
      'cream_swirl',
    ])
  })

  it('drops cake ids when family is savoury', () => {
    const diagnostics = diagnoseRecommendedStackIds(
      ['coriander', 'powdered_sugar', 'lime_wedge'],
      [],
      'savory',
    )
    expect(diagnostics.droppedCrossFamilyIds).toEqual(['powdered_sugar'])
    expect(diagnostics.stack.map((item) => item.id)).toEqual(['coriander', 'lime_wedge'])
  })

  it('treats a missing family as savoury', () => {
    const diagnostics = diagnoseRecommendedStackIds(['fresh_berries', 'powdered_sugar'], [])
    expect(diagnostics.family).toBe('savory')
    expect(diagnostics.fallbackUsed).toBe(true)
    expect(diagnostics.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })
})

describe('inferFinishingTouchFamilyFromText', () => {
  it('treats dessert cakes as cake and savoury cakes as savoury', () => {
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Chocolate cake' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ mainItem: 'New York cheesecake' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Crab cake' })).toBe('savory')
    expect(inferFinishingTouchFamilyFromText({ mainItem: 'fish cakes with tartare' })).toBe(
      'savory',
    )
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Banana Bread' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Chocolate & Salted Caramel Tart' })).toBe(
      'cake',
    )
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Tomato tart' })).toBe('savory')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Lemon tart' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Apple tart' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ mainItem: 'mixed berry tart' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Caramelized onion tart' })).toBe('savory')
    expect(inferFinishingTouchFamilyFromText({ mainItem: 'apple pie' })).toBe('cake')
    expect(inferFinishingTouchFamilyFromText({ dishName: "Shepherd's pie" })).toBe('savory')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Steak tartare' })).toBe('savory')
    expect(inferFinishingTouchFamilyFromText({ dishName: 'Massaman Curry' })).toBe('savory')
  })
})

describe('buildFinishingTouchesUserPrompt', () => {
  it('uses the current empty component list and provided extraction description', () => {
    const prompt = buildFinishingTouchesUserPrompt({
      dishName: 'Massaman Curry',
      mainItem: 'Massaman curry',
      garnishes: [],
      sides: [],
      description: 'A bowl of curry and rice.',
    })

    expect(prompt).toContain('User-provided dish name: Massaman Curry.')
    expect(prompt).toContain('Visual identification: Massaman curry.')
    expect(prompt).toContain('Original photograph analysis: A bowl of curry and rice.')
    expect(prompt).toContain('The current variant has no listed garnishes or sides.')
    expect(prompt).not.toContain('Currently present on this variant:')
  })

  it('includes only the component names supplied for this request', () => {
    const prompt = buildFinishingTouchesUserPrompt({
      mainItem: 'Massaman curry',
      garnishes: ['lime wedges'],
      sides: ['rice'],
    })

    expect(prompt).toContain('Currently present on this variant: lime wedges, rice.')
  })

  it('treats original-photo garnishes as compatibility evidence, not exclusions', () => {
    const prompt = buildFinishingTouchesUserPrompt({
      dishName: 'Massaman Curry',
      mainItem: 'chicken and potato curry with white rice',
      garnishes: [],
      sides: [],
      description: 'Garnished with lime wedges, cashews, chilli and cilantro.',
    })

    expect(prompt).toContain(
      'Treat garnishes mentioned there as evidence of culinary compatibility',
    )
    expect(prompt).toContain(
      'Original-photo garnishes may be recommended when absent from the current variant.',
    )
    expect(prompt).toContain('Savory ids:')
    expect(prompt).toContain('Cake ids:')
    expect(prompt).toContain('coriander (Coriander)')
    expect(prompt).toContain('fresh_berries (Fresh berries)')
    expect(prompt).toContain('lemon_drizzle (Lemon drizzle)')
    expect(prompt).toContain('dill (Dill)')
    expect(prompt).toContain('cocoa_dusting (Cocoa dusting)')
    expect(prompt).toContain('Recommend up to 12 ids from the chosen family')
    expect(prompt).toContain('propIds: up to 4 prop ids')
    expect(prompt).toContain('chopsticks (Chopsticks, savory)')
    expect(prompt).toContain('flour-bag (Bag of flour, cake)')
    expect(prompt).toContain('choose only props marked cake or any')
    expect(prompt).not.toContain('rank every appropriate cake id')
  })
})

describe('recommendFinishingTouches', () => {
  it('returns the sanitised Gemini ids for a massaman-like dish', async () => {
    const fetchJson = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  ids: ['coriander', 'lime_wedge', 'red_chilli', 'cashews'],
                }),
              },
            ],
          },
        },
      ],
    })

    const recommendation = await recommendFinishingTouches(
      {
        dishName: 'Massaman Curry',
        mainItem: 'massaman curry with rice',
        garnishes: [],
        sides: [],
      },
      { fetchJson, apiKey: 'test-key' },
    )
    expect(recommendation.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'cashews',
    ])
    expect(recommendation.props).toEqual([])
    expect(fetchJson).toHaveBeenCalled()
    const request = fetchJson.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(request.body)) as {
      contents: Array<{ parts: Array<{ text: string }> }>
      generationConfig: {
        temperature: number
        thinkingConfig: { thinkingBudget: number }
      }
    }
    expect(body.contents[0]?.parts[0]?.text).toContain(
      'User-provided dish name: Massaman Curry.',
    )
    expect(body.generationConfig.temperature).toBe(0)
    expect(body.generationConfig.thinkingConfig.thinkingBudget).toBe(512)
  })

  it('falls back when Gemini fails', async () => {
    const fetchJson = jest.fn().mockRejectedValue(new Error('unavailable'))
    const recommendation = await recommendFinishingTouches(
      { mainItem: 'unknown' },
      { fetchJson, apiKey: 'test-key' },
    )
    expect(recommendation.props).toEqual([])
    expect(recommendation.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })

  it('falls back without an API key', async () => {
    const recommendation = await recommendFinishingTouches(
      { mainItem: 'soup' },
      { apiKey: '' },
    )
    expect(recommendation.stack.length).toBeGreaterThan(0)
    expect(recommendation.props).toEqual([])
    expect(recommendation.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })

  it('uses the cake fallback for a dessert cake when the API key is missing', async () => {
    const recommendation = await recommendFinishingTouches(
      { dishName: 'Chocolate cake', mainItem: 'chocolate layer cake' },
      { apiKey: '' },
    )
    expect(recommendation.stack.map((item) => item.id)).toEqual([
      'fresh_berries',
      'powdered_sugar',
      'chocolate_shavings',
      'mint_sprig',
    ])
    expect(recommendation.props).toEqual([])
  })

  it('keeps the savoury fallback for a crab cake when ranking fails', async () => {
    const fetchJson = jest.fn().mockRejectedValue(new Error('unavailable'))
    const recommendation = await recommendFinishingTouches(
      { dishName: 'Crab cake', mainItem: 'pan-fried crab cake' },
      { fetchJson, apiKey: 'test-key' },
    )
    expect(recommendation.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })

  it('accepts Gemini cake family ids and ignores savoury ids in that payload', async () => {
    const fetchJson = jest.fn().mockResolvedValue({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  family: 'cake',
                  ids: ['fresh_berries', 'coriander', 'powdered_sugar'],
                  propIds: ['jam-jar', 'not-a-prop', 'berry-bowl', 'chopsticks', 'fork'],
                }),
              },
            ],
          },
        },
      ],
    })

    const recommendation = await recommendFinishingTouches(
      { dishName: 'Chocolate cake', mainItem: 'chocolate cake slice' },
      { fetchJson, apiKey: 'test-key' },
    )
    expect(recommendation.stack.map((item) => item.id)).toEqual([
      'fresh_berries',
      'powdered_sugar',
    ])
    expect(recommendation.props.map((prop) => prop.id)).toEqual(['jam-jar', 'berry-bowl'])
    expect(recommendation.family).toBe('cake')
  })
})

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

  it('reports overflow and an empty-response fallback', () => {
    const overflow = diagnoseRecommendedStackIds(
      ['coriander', 'lime_wedge', 'red_chilli', 'cashews', 'parsley'],
      [],
    )
    expect(overflow.droppedOverflowIds).toEqual(['parsley'])

    const fallback = diagnoseRecommendedStackIds([], [])
    expect(fallback.fallbackUsed).toBe(true)
    expect(fallback.stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
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

    const stack = await recommendFinishingTouches(
      {
        dishName: 'Massaman Curry',
        mainItem: 'massaman curry with rice',
        garnishes: [],
        sides: [],
      },
      { fetchJson, apiKey: 'test-key' },
    )
    expect(stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'cashews',
    ])
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
    const stack = await recommendFinishingTouches(
      { mainItem: 'unknown' },
      { fetchJson, apiKey: 'test-key' },
    )
    expect(stack.map((item) => item.id)).toEqual([
      'coriander',
      'lime_wedge',
      'red_chilli',
      'sesame_seeds',
    ])
  })

  it('falls back without an API key', async () => {
    const stack = await recommendFinishingTouches(
      { mainItem: 'soup' },
      { apiKey: '' },
    )
    expect(stack.length).toBeGreaterThan(0)
  })
})

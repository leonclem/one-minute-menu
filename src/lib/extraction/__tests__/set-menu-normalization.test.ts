import { describe, it, expect } from 'vitest'
import { createMenuExtractionService } from '@/lib/extraction/menu-extraction-service'

// Minimal fake supabase client for constructor
const fakeSupabase = {
  from() {
    return {
      select: () => ({ single: () => ({ data: null, error: null }) }),
      insert: () => ({ select: () => ({ single: () => ({ data: { id: '1' }, error: null }) }) }),
      update: () => ({ eq: () => ({ select: () => ({ single: () => ({ data: {}, error: null }) }) }) }),
      eq: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }),
      order: () => ({ limit: () => ({ single: () => ({ data: null, error: { message: 'not found' } }) }) })
    }
  }
} as any

describe('Stage 2 normalization - set menu option price deltas', () => {
  it('parses price deltas embedded in set menu option names', async () => {
    const svc = createMenuExtractionService('test-key', fakeSupabase) as any

    const raw = {
      menu: {
        categories: [
          {
            name: 'SETS',
            items: [
              {
                name: 'Lunch Set',
                confidence: 0.9,
                price: 20,
                type: 'set_menu',
                setMenu: {
                  courses: [
                    {
                      name: 'Main',
                      options: [
                        { name: 'Pasta (+$3)' },
                        { name: 'Steak +5' },
                        { name: 'Fish (add $4.50)' },
                        { name: 'Chicken' }
                      ]
                    }
                  ]
                }
              }
            ],
            confidence: 0.9
          }
        ]
      },
      currency: 'USD',
      uncertainItems: [],
      superfluousText: []
    }

    const normalized = svc["normalizeStage2Extraction"](raw)
    const opts = normalized.menu.categories[0].items[0].setMenu.courses[0].options

    expect(opts[0]).toEqual({ name: 'Pasta', priceDelta: 3 })
    expect(opts[1]).toEqual({ name: 'Steak', priceDelta: 5 })
    expect(opts[2]).toEqual({ name: 'Fish', priceDelta: 4.5 })
    expect(opts[3]).toEqual({ name: 'Chicken' })
  })
})



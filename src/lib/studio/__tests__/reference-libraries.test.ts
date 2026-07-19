/**
 * @jest-environment node
 */

const mockOrder = jest.fn()
const mockMaybeSingle = jest.fn()
const mockInsertSingle = jest.fn()
const mockUpdateSingle = jest.fn()
const mockDeleteEq = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => mockOrder(),
          eq: () => ({
            maybeSingle: () => mockMaybeSingle(),
          }),
          maybeSingle: () => mockMaybeSingle(),
        }),
        order: () => mockOrder(),
      }),
      insert: () => ({
        select: () => ({
          single: () => mockInsertSingle(),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => mockUpdateSingle(),
          }),
        }),
      }),
      delete: () => ({
        eq: () => mockDeleteEq(),
      }),
    }),
  }),
}))

import {
  buildStyleDirectiveClause,
  createLightingStyle,
  listActiveLightingStyles,
  resolveLightingStyle,
} from '../reference-libraries'

describe('reference-libraries', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lists active lighting styles (display fields)', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: '1',
          key: 'low-key',
          name: 'Moody',
          short_description: null,
          thumbnail_path: 'light-moody',
          sort_order: 10,
        },
      ],
      error: null,
    })

    const styles = await listActiveLightingStyles()
    expect(styles).toHaveLength(1)
    expect(styles[0].key).toBe('low-key')
    expect(styles[0]).not.toHaveProperty('prompt_fragment')
  })

  it('resolves an active lighting style with prompt fragment', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: '1',
        key: 'low-key',
        name: 'Moody',
        short_description: null,
        thumbnail_path: 'light-moody',
        sort_order: 10,
        prompt_fragment: 'Change lighting to low-key.',
        negative_constraints: 'No props.',
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      error: null,
    })

    const style = await resolveLightingStyle('low-key')
    expect(style?.prompt_fragment).toContain('low-key')
  })

  it('creates a lighting style with normalized key', async () => {
    mockInsertSingle.mockResolvedValue({
      data: {
        id: 'new',
        key: 'warm-glow',
        name: 'Warm Glow',
        short_description: null,
        thumbnail_path: null,
        sort_order: 0,
        prompt_fragment: 'Warm glow lighting.',
        negative_constraints: null,
        is_active: true,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      error: null,
    })

    const style = await createLightingStyle({
      key: 'Warm Glow',
      name: 'Warm Glow',
      promptFragment: 'Warm glow lighting.',
    })
    expect(style.key).toBe('warm-glow')
  })

  it('builds a directive clause with optional constraints', () => {
    expect(buildStyleDirectiveClause('Do the thing.', 'No props.')).toBe(
      'Do the thing. No props.',
    )
    expect(buildStyleDirectiveClause('Do the thing.', null)).toBe('Do the thing.')
  })
})

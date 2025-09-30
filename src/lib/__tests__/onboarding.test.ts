import { computeOnboardingStatus } from '@/lib/onboarding'

describe('computeOnboardingStatus', () => {
  test('returns empty state when no menus', () => {
    const s = computeOnboardingStatus([])
    expect(s.hasMenu).toBe(false)
    expect(s.hasImage).toBe(false)
    expect(s.hasItems).toBe(false)
    expect(s.isPublished).toBe(false)
    expect(s.completionPercent).toBe(0)
  })

  test('handles draft menu progression', () => {
    const base = {
      id: 'm1',
      status: 'draft',
      items: [],
      updatedAt: new Date('2024-01-01T00:00:00Z'),
    }

    const s0 = computeOnboardingStatus([base])
    expect(s0.hasMenu).toBe(true)
    expect(s0.completionPercent).toBe(25)

    const s1 = computeOnboardingStatus([{ ...base, imageUrl: 'x' }])
    expect(s1.hasImage).toBe(true)
    expect(s1.completionPercent).toBe(50)

    const s2 = computeOnboardingStatus([{ ...base, imageUrl: 'x', items: [{ id: 'i', name: 'A', price: 1, available: true, order: 1 }] }])
    expect(s2.hasItems).toBe(true)
    expect(s2.completionPercent).toBe(80)
  })

  test('handles published menu as complete', () => {
    const s = computeOnboardingStatus([
      { id: 'm1', status: 'published', items: [], updatedAt: new Date(), imageUrl: 'x' },
    ])
    expect(s.isPublished).toBe(true)
    expect(s.completionPercent).toBe(100)
  })

  test('handles snake_case fields from API', () => {
    const s = computeOnboardingStatus([
      { id: 'm2', status: 'draft', items: [], updated_at: '2024-02-02T00:00:00Z', image_url: 'y' },
    ] as any[])
    expect(s.hasMenu).toBe(true)
    expect(s.hasImage).toBe(true)
    expect(s.completionPercent).toBe(50)
  })
})



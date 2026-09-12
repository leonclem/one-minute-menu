/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockRecommend = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/finishing-touches/recommend', () => ({
  recommendFinishingTouches: (...args: unknown[]) => mockRecommend(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../finishing-touches/recommend/route'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost:3000/api/studio/finishing-touches/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/studio/finishing-touches/recommend', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns 401 when unauthenticated', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const res = await POST(makeRequest({ mainItem: 'curry' }))
    expect(res.status).toBe(401)
    expect(mockRecommend).not.toHaveBeenCalled()
  })

  it('returns a schema-shaped stack for an authenticated user', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockRecommend.mockResolvedValue([
      { id: 'coriander', name: 'Coriander' },
      { id: 'lime_wedge', name: 'Lime wedges' },
    ])

    const res = await POST(
      makeRequest({
        dishName: 'Massaman Curry',
        mainItem: 'massaman curry with rice',
        garnishes: [],
        sides: [],
      }),
    )
    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      stackIds: ['coriander', 'lime_wedge'],
      stack: [
        { id: 'coriander', name: 'Coriander' },
        { id: 'lime_wedge', name: 'Lime wedges' },
      ],
    })
    expect(mockRecommend).toHaveBeenCalledWith({
      dishName: 'Massaman Curry',
      mainItem: 'massaman curry with rice',
      garnishes: [],
      sides: [],
    })
  })

  it('returns 400 for an invalid payload', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })

    const res = await POST(makeRequest({ garnishes: 'nope' }))
    expect(res.status).toBe(400)
    expect(mockRecommend).not.toHaveBeenCalled()
  })

  it('accepts extracted garnish and side phrases longer than 80 characters', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: 'user-1' },
      supabase: {},
    })
    mockRecommend.mockResolvedValue([{ id: 'coriander', name: 'Coriander' }])

    const body = {
      dishName: 'Hainanese Chicken',
      mainItem:
        'Hainanese chicken rice, consisting of a dome of white rice, sliced poached chicken, and a base of lettuce and sliced tomatoes.',
      garnishes: [
        'fresh cilantro sprigs',
        'sliced cucumber',
        'green lettuce leaves',
        'red tomato slices',
      ],
      sides: [
        'two halves of braised egg',
        'two dipping sauces (greenish and reddish-orange) in a small white rectangular dish',
        'a small white bowl (partially visible, likely soup)',
      ],
      description:
        'A well-lit Hainanese chicken rice dish is presented on a large oval white plate, featuring a dome of white rice, slices of steamed chicken, braised eggs, and fresh garnishes. The dish is accompanied by two dipping sauces and cutlery, all set on a light wooden tabletop.',
    }

    const res = await POST(makeRequest(body))
    expect(res.status).toBe(200)
    expect(mockRecommend).toHaveBeenCalledWith(body)
  })
})

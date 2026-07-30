/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockAssertOwnsStudioImage = jest.fn()
const mockUpsertStudioImageFeedback = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/studio/feedback/feedback-store', () => ({
  assertOwnsStudioImage: (...args: unknown[]) => mockAssertOwnsStudioImage(...args),
  upsertStudioImageFeedback: (...args: unknown[]) => mockUpsertStudioImageFeedback(...args),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { POST } from '../feedback/route'

const USER_ID = '123e4567-e89b-42d3-a456-426614174001'
const IMAGE_ID = '123e4567-e89b-42d3-a456-426614174002'

const createdFeedback = {
  user_id: USER_ID,
  studio_image_id: IMAGE_ID,
  dish_id: '123e4567-e89b-42d3-a456-426614174003',
  rating: 5,
  reason_tags: ['useful_result'],
  comment: 'Looks ready to use.',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const updatedFeedback = {
  ...createdFeedback,
  rating: 4,
  reason_tags: ['style_missed'],
  comment: 'The styling needs another pass.',
  updated_at: '2026-01-02T00:00:00.000Z',
}

function createRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/studio/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/studio/feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockRequireStudioApi.mockResolvedValue({
      ok: true,
      user: { id: USER_ID },
      supabase: {},
    })
    mockAssertOwnsStudioImage.mockResolvedValue({
      owned: true,
      dishId: createdFeedback.dish_id,
    })
    mockUpsertStudioImageFeedback.mockResolvedValue({
      row: createdFeedback,
      isUpdate: false,
    })
  })

  it('creates feedback for an image owned by the authenticated user', async () => {
    const response = await POST(
      createRequest({
        studioImageId: IMAGE_ID,
        rating: 5,
        reasonTags: ['useful_result'],
        comment: 'Looks ready to use.',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      feedback: createdFeedback,
      isUpdate: false,
    })
    expect(mockAssertOwnsStudioImage).toHaveBeenCalledWith({}, USER_ID, IMAGE_ID)
    expect(mockUpsertStudioImageFeedback).toHaveBeenCalledWith({
      userId: USER_ID,
      dishId: createdFeedback.dish_id,
      value: {
        studioImageId: IMAGE_ID,
        rating: 5,
        reasonTags: ['useful_result'],
        comment: 'Looks ready to use.',
      },
    })
  })

  it('updates existing feedback for an image owned by the authenticated user', async () => {
    mockUpsertStudioImageFeedback.mockResolvedValue({
      row: updatedFeedback,
      isUpdate: true,
    })

    const response = await POST(
      createRequest({
        studioImageId: IMAGE_ID,
        rating: 4,
        reasonTags: ['style_missed'],
        comment: 'The styling needs another pass.',
      }),
    )
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data).toEqual({
      success: true,
      feedback: updatedFeedback,
      isUpdate: true,
    })
    expect(mockUpsertStudioImageFeedback).toHaveBeenCalledWith({
      userId: USER_ID,
      dishId: createdFeedback.dish_id,
      value: {
        studioImageId: IMAGE_ID,
        rating: 4,
        reasonTags: ['style_missed'],
        comment: 'The styling needs another pass.',
      },
    })
  })

  it('returns 403 for a non-owner without writing a feedback row', async () => {
    mockAssertOwnsStudioImage.mockResolvedValue({ owned: false, dishId: null })

    const response = await POST(
      createRequest({ studioImageId: IMAGE_ID, rating: 3 }),
    )
    const data = await response.json()

    expect(response.status).toBe(403)
    expect(data).toEqual({ error: 'Forbidden', code: 'FEEDBACK_NOT_OWNER' })
    expect(mockAssertOwnsStudioImage).toHaveBeenCalledWith({}, USER_ID, IMAGE_ID)
    expect(mockUpsertStudioImageFeedback).not.toHaveBeenCalled()
  })

  it('returns 401 for an unauthenticated request without writing a feedback row', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(
      createRequest({ studioImageId: IMAGE_ID, rating: 5 }),
    )

    expect(response.status).toBe(401)
    expect(mockAssertOwnsStudioImage).not.toHaveBeenCalled()
    expect(mockUpsertStudioImageFeedback).not.toHaveBeenCalled()
  })

  it('returns 400 for a comment longer than 1000 characters without checking ownership', async () => {
    const response = await POST(
      createRequest({ studioImageId: IMAGE_ID, comment: 'x'.repeat(1001) }),
    )
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      error: 'Invalid feedback submission',
      code: 'FEEDBACK_COMMENT_TOO_LONG',
    })
    expect(mockAssertOwnsStudioImage).not.toHaveBeenCalled()
    expect(mockUpsertStudioImageFeedback).not.toHaveBeenCalled()
  })

  it('returns 400 for an empty submission without checking ownership', async () => {
    const response = await POST(createRequest({ studioImageId: IMAGE_ID }))
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data).toEqual({
      error: 'Invalid feedback submission',
      code: 'FEEDBACK_EMPTY',
    })
    expect(mockAssertOwnsStudioImage).not.toHaveBeenCalled()
    expect(mockUpsertStudioImageFeedback).not.toHaveBeenCalled()
  })

  it.each([
    {
      name: 'unauthenticated requests',
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
      status: 401,
    },
    {
      name: 'authenticated users without Studio access',
      response: new Response(
        JSON.stringify({
          error: 'Forbidden - Studio access required',
          reason: 'denied_beta_access_required',
        }),
        { status: 403 },
      ),
      status: 403,
    },
  ])('applies $name before validation and ownership', async ({ response, status }) => {
    mockRequireStudioApi.mockResolvedValue({ ok: false, response })

    const result = await POST(createRequest({ studioImageId: IMAGE_ID }))
    const data = await result.json()

    expect(result.status).toBe(status)
    expect(data.error).toBeDefined()
    expect(mockAssertOwnsStudioImage).not.toHaveBeenCalled()
    expect(mockUpsertStudioImageFeedback).not.toHaveBeenCalled()
  })
})

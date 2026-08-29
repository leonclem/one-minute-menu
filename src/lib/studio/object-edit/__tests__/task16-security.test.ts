const mockMaybeSingle = jest.fn()

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: mockMaybeSingle }),
      }),
    }),
  }),
}))

import {
  createObjectEditRequestId,
  objectEditDiagnosticContext,
  sanitizeObjectEditDiagnostic,
} from '../diagnostics'
import { assertAuthorisedObjectEditReviewer } from '../operation-controls'
import {
  buildGenerationCompletedPayload,
  sanitizeStudioProperties,
  trackStudioEvent,
} from '../../analytics/studio-analytics'

describe('Task 16 privacy-safe diagnostics and analytics', () => {
  it('drops bytes, URLs, prompts, labels, coordinates, and unknown diagnostic values', () => {
    const result = sanitizeObjectEditDiagnostic({
      request_id: 'request-1',
      user_id: 'user-1',
      image_id: 'image-1',
      operation: 'remove',
      stage: 'submitted',
      bytes: 'raw image bytes',
      url: 'https://example.invalid/source.png',
      prompt: 'remove the rice at 0.24,0.68',
      label: 'rice',
      coordinates: { x: 0.24, y: 0.68 },
      provider_response: { candidates: [] },
      reviewer_rationale: 'private review text',
    })

    expect(result).toEqual({
      request_id: 'request-1',
      user_id: 'user-1',
      image_id: 'image-1',
      operation: 'remove',
      stage: 'submitted',
    })
  })

  it('keeps diagnostic context bounded and correlation-safe', () => {
    const requestId = createObjectEditRequestId()
    const result = objectEditDiagnosticContext({
      requestId,
      userId: 'user-1',
      dishId: 'dish-1',
      imageId: 'image-1',
      operation: 'remove',
      modelClass: 'nb2',
      stage: 'provider',
      durationMs: 12.7,
      error: new Error('contains a prompt and https://example.invalid'),
      softFailure: 'spatial_inventory_read',
    })

    expect(result).toEqual({
      request_id: requestId,
      user_id: 'user-1',
      dish_id: 'dish-1',
      image_id: 'image-1',
      operation: 'remove',
      model_class: 'nb2',
      stage: 'provider',
      duration_ms: 13,
      error_type: 'Error',
      soft_failure: 'spatial_inventory_read',
    })
    expect(JSON.stringify(result)).not.toContain('https://')
  })

  it('keeps analytics properties coarse and rejects compound sensitive values', () => {
    expect(
      sanitizeStudioProperties({
        generation_kind: 'object_edit',
        edit_operation: 'remove',
        count_bucket: '1-3',
        prompt: 'remove this',
        coordinates: { x: 0.1, y: 0.2 },
        image_url: 'https://example.invalid/image.png',
      }),
    ).toEqual({
      generation_kind: 'object_edit',
      edit_operation: 'remove',
      count_bucket: '1-3',
    })

    expect(
      buildGenerationCompletedPayload({
        model: 'gemini-3.1-flash-image-preview',
        validationStatus: 'skipped',
        startedAt: 100,
        endedAt: 250,
        balanceAfter: 8,
        generationKind: 'object_edit',
        editOperation: 'remove',
      }),
    ).toEqual(expect.objectContaining({
      generation_kind: 'object_edit',
      edit_operation: 'remove',
    }))
    expect(() =>
      trackStudioEvent('studio_object_edit_opened', {
        edit_operation: 'remove',
        prompt: 'do not send this',
      }),
    ).not.toThrow()
  })
})

describe('Task 16 reviewer authorization', () => {
  beforeEach(() => jest.clearAllMocks())

  it('allows only an administrator to mutate evidence/control state', async () => {
    mockMaybeSingle.mockResolvedValue({ data: { role: 'admin' }, error: null })
    await expect(
      assertAuthorisedObjectEditReviewer('61b3a294-2a76-4be9-a0f0-0123456789ab'),
    ).resolves.toBeUndefined()
  })

  it('rejects a non-admin or profile lookup failure', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: { role: 'user' }, error: null })
    await expect(
      assertAuthorisedObjectEditReviewer('61b3a294-2a76-4be9-a0f0-0123456789ab'),
    ).rejects.toThrow('authorised Studio administrator')

    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: new Error('database unavailable') })
    await expect(
      assertAuthorisedObjectEditReviewer('61b3a294-2a76-4be9-a0f0-0123456789ab'),
    ).rejects.toThrow('authorised Studio administrator')
  })
})

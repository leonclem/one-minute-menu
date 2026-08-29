/** @jest-environment node */

import { NextRequest } from 'next/server'
import { deriveSelectionBoundingRegion } from '@/lib/studio/object-edit/contracts'

const mockRequireStudioApi = jest.fn()
const mockLoadOwnedDishSource = jest.fn()
const mockLoadBytes = jest.fn()
const mockGuard = jest.fn()
const mockMutate = jest.fn()
const mockEstablishCanonical = jest.fn()
const mockLoadSpatial = jest.fn()
const mockMatchSpatial = jest.fn()
const mockPersistSpatial = jest.fn()
const mockPrepareImages = jest.fn()
const mockExtractEvidence = jest.fn()
const mockScoreEvidence = jest.fn()
const mockFinalize = jest.fn()
const mockMapGenerationError = jest.fn()

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))
jest.mock('@/lib/studio/owned-source', () => ({
  loadOwnedDishSource: (...args: unknown[]) => mockLoadOwnedDishSource(...args),
  OwnedStudioSourceNotFoundError: class OwnedStudioSourceNotFoundError extends Error {},
}))
jest.mock('@/lib/studio/image-bytes', () => ({
  loadStudioImageBytes: (...args: unknown[]) => mockLoadBytes(...args),
  StudioImageLoadError: class StudioImageLoadError extends Error {
    status = 400
  },
}))
jest.mock('@/lib/studio/generation-request', () => ({
  guardStudioGeneration: (...args: unknown[]) => mockGuard(...args),
  mapStudioGenerationError: (...args: unknown[]) => mockMapGenerationError(...args),
}))
jest.mock('@/lib/photo-control/mutation-engine', () => ({
  getMutationEngine: () => ({ mutate: (...args: unknown[]) => mockMutate(...args) }),
}))
jest.mock('@/lib/studio/object-edit/canonical-state', () => {
  const actual = jest.requireActual('@/lib/studio/object-edit/canonical-state')
  return {
    ...actual,
    establishCanonicalSourceState: (...args: unknown[]) => mockEstablishCanonical(...args),
  }
})
jest.mock('@/lib/studio/object-edit/spatial-inventory', () => {
  const actual = jest.requireActual('@/lib/studio/object-edit/spatial-inventory')
  return {
    ...actual,
    loadSpatialInventory: (...args: unknown[]) => mockLoadSpatial(...args),
    matchSpatialElement: (...args: unknown[]) => mockMatchSpatial(...args),
    persistSpatialInventory: (...args: unknown[]) => mockPersistSpatial(...args),
  }
})
jest.mock('@/lib/studio/object-edit/reference-image', () => {
  const actual = jest.requireActual('@/lib/studio/object-edit/reference-image')
  return {
    ...actual,
    prepareObjectEditImages: (...args: unknown[]) => mockPrepareImages(...args),
  }
})
jest.mock('@/lib/studio/output-validation', () => ({
  extractStudioOutputEvidence: (...args: unknown[]) => mockExtractEvidence(...args),
  scoreStudioOutputEvidence: (...args: unknown[]) => mockScoreEvidence(...args),
}))
jest.mock('@/lib/studio/finalize-generation-atomic', () => ({
  finalizeStudioGenerationAtomic: (...args: unknown[]) => mockFinalize(...args),
}))
jest.mock('@/lib/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

import { POST } from '../object-edit/route'
import { CanonicalSourceStateError } from '@/lib/studio/object-edit/canonical-state'
import { ObjectEditImagePreparationError } from '@/lib/studio/object-edit/reference-image'

const dishId = '61b3a294-2a76-4be9-a0f0-0123456789ab'
const sourceImageId = '0135d7b0-61a1-4de1-9de6-0123456789ab'
const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const selection = {
  version: 1 as const,
  strokes: [{ kind: 'tap' as const, points: [{ x: 0.24, y: 0.68 }] }],
  boundingRegion: deriveSelectionBoundingRegion([{ kind: 'tap', points: [{ x: 0.24, y: 0.68 }] }]),
}
const preparedImages = {
  clean: { data: tinyPng, mimeType: 'image/png' as const, width: 1, height: 1 },
  annotated: { data: tinyPng, mimeType: 'image/png' as const, width: 1, height: 1 },
  rendererVersion: 1 as const,
  renderDigest: 'a'.repeat(64),
  guidance: {
    selectionStrokeCount: 1,
    targetMarkerCount: 1,
    destinationMarkerCount: 0,
    moveArrowCount: 0,
    hasMovePlacementGuide: false,
    hasTranslatedBoundingGuide: false,
  },
}
const validBody = {
  dishId,
  sourceImageId,
  model: 'gemini-3.1-flash-image-preview',
  editIntent: { version: 1 as const, operation: 'remove' as const, selection },
}

function request(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost:3000/api/studio/object-edit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  process.env.NANO_BANANA_API_KEY = 'test-key'
  mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'user-1' }, supabase: {} })
  mockLoadOwnedDishSource.mockResolvedValue({
    dish: { id: dishId },
    image: {
      id: sourceImageId,
      user_id: 'user-1',
      dish_id: dishId,
      mime_type: 'image/png',
      width: 1,
      height: 1,
      metadata: {},
    },
  })
  mockGuard.mockResolvedValue({
    requestedModel: 'gemini-3.1-flash-image-preview',
    creditCost: 1,
    usedToday: 0,
    dailyLimit: 25,
    dish: { id: dishId },
  })
  mockLoadBytes.mockResolvedValue({ mimeType: 'image/png', base64: tinyPng, byteLength: 68 })
  mockEstablishCanonical.mockResolvedValue({
    version: 1,
    hydrated: false,
    editorState: {
      schema: {
        scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-clean', spin: '0' },
        canvas: { background: '', background_style: '', surface_style: '', main_vessel: '' },
        food_components: { main_item: 'rice', garnishes: [], sides: [] },
      },
      position: { x: 0, y: 0 },
    },
    schema: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-clean', spin: '0' },
      canvas: { background: '', background_style: '', surface_style: '', main_vessel: '' },
      food_components: { main_item: 'rice', garnishes: [], sides: [] },
    },
  })
  mockLoadSpatial.mockResolvedValue(null)
  mockMatchSpatial.mockReturnValue({ matched: false, reason: 'no-match' })
  mockPersistSpatial.mockResolvedValue(undefined)
  mockPrepareImages.mockResolvedValue(preparedImages)
  mockMutate.mockResolvedValue({ imageBase64: tinyPng, providerModelIdentity: 'provider-model' })
  mockExtractEvidence.mockResolvedValue(null)
  mockScoreEvidence.mockReturnValue({ status: 'skipped', score: 0, summary: 'skipped' })
  mockFinalize.mockResolvedValue({
    success: {
      imageUrl: 'https://cdn.example/child.png',
      imageId: 'child-image-id',
      dishId,
      model: 'gemini-3.1-flash-image-preview',
      validationStatus: 'skipped',
      credits: { cost: 1, balanceAfter: 9 },
    },
  })
  mockMapGenerationError.mockResolvedValue(new Response(JSON.stringify({ error: 'internal' }), { status: 500 }))
})

describe('POST /api/studio/object-edit', () => {
  it('authenticates before touching the request or any source boundary', async () => {
    mockRequireStudioApi.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    })

    const response = await POST(request(validBody))

    expect(response.status).toBe(401)
    expect(mockLoadOwnedDishSource).not.toHaveBeenCalled()
    expect(mockLoadBytes).not.toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('enforces the request limit from actual bytes even without a trustworthy content-length header', async () => {
    const response = await POST(request({ ...validBody, padding: 'x'.repeat(270 * 1024) }))

    expect(response.status).toBe(413)
    expect((await response.json()).code).toBe('OBJECT_EDIT_REQUEST_TOO_LARGE')
    expect(mockLoadOwnedDishSource).not.toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('rejects strict-invalid input before source, provider, or finalization work', async () => {
    const response = await POST(request({ ...validBody, unexpected: true }))

    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('OBJECT_EDIT_INVALID_REQUEST')
    expect(mockLoadOwnedDishSource).not.toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
    expect(mockFinalize).not.toHaveBeenCalled()
  })

  it('keeps Move excluded even when a caller submits the shared Move contract', async () => {
    const response = await POST(request({
      ...validBody,
      editIntent: { version: 1, operation: 'move', selection, placement: { source: { x: 0.24, y: 0.68 }, destination: { x: 0.8, y: 0.8 } } },
    }))

    expect(response.status).toBe(403)
    expect((await response.json()).code).toBe('OBJECT_EDIT_UNAVAILABLE')
    expect(mockLoadOwnedDishSource).not.toHaveBeenCalled()
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('validates ownership before loading bytes and performs the Remove provider/finalizer path', async () => {
    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      imageUrl: 'https://cdn.example/child.png',
      imageId: 'child-image-id',
      dishId,
      model: 'gemini-3.1-flash-image-preview',
      validationStatus: 'skipped',
      credits: { cost: 1, balanceAfter: 9 },
    })
    expect(mockLoadOwnedDishSource.mock.invocationCallOrder[0]).toBeLessThan(
      mockLoadBytes.mock.invocationCallOrder[0],
    )
    expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({
      request_scope: 'studio_object_edit',
      annotationReference: expect.objectContaining({ mimeType: 'image/png' }),
    }))
    expect(mockFinalize).toHaveBeenCalledWith(expect.objectContaining({
      sourceImageId,
      dishId,
      objectEdit: expect.objectContaining({
        operation: 'remove',
        directParentImageId: sourceImageId,
        selectedSourceImageId: sourceImageId,
        selection,
      }),
    }))
  })

  it('maps canonical establishment failure before provider invocation and preserves a typed pre-submission response', async () => {
    mockEstablishCanonical.mockRejectedValue(new CanonicalSourceStateError('Canonical source is unavailable.'))

    const response = await POST(request(validBody))

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({
      error: 'Canonical source is unavailable.',
      code: 'INVALID_CANONICAL_SOURCE_STATE',
    })
    expect(mockMutate).not.toHaveBeenCalled()
    expect(mockFinalize).not.toHaveBeenCalled()
  })

  it('maps image-pair preparation failure before provider invocation and finalization', async () => {
    mockPrepareImages.mockRejectedValue(
      new ObjectEditImagePreparationError('Source image data could not be decoded.'),
    )

    const response = await POST(request(validBody))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'Source image data could not be decoded.',
      code: 'OBJECT_EDIT_INPUT_PREPARATION_FAILED',
    })
    expect(mockMutate).not.toHaveBeenCalled()
    expect(mockFinalize).not.toHaveBeenCalled()
  })

  it('persists a matched Remove spatial delta as a soft, child-bound post-commit step', async () => {
    const parentElement = {
      id: '22222222-2222-4222-8222-222222222222',
      label: 'rice',
      componentRef: { section: 'food_components' as const, field: 'main_item' as const, value: 'rice' },
      hint: { kind: 'center' as const, center: { x: 0.24, y: 0.68 } },
      visibility: 'visible' as const,
    }
    mockLoadSpatial.mockResolvedValue({
      version: 1,
      imageId: sourceImageId,
      naturalWidth: 1,
      naturalHeight: 1,
      elements: [parentElement],
      extractedAt: '2026-01-01T00:00:00.000Z',
      extractorVersion: 'test',
    })
    mockMatchSpatial.mockReturnValue({ matched: true, element: parentElement, score: 1 })

    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(mockPersistSpatial).toHaveBeenCalledWith({
      userId: 'user-1',
      dishId,
      inventory: expect.objectContaining({
        imageId: 'child-image-id',
        elements: [expect.objectContaining({ id: parentElement.id, visibility: 'removed' })],
      }),
    })
  })

  it('does not fail a committed Remove when optional child spatial persistence fails', async () => {
    const parentElement = {
      id: '22222222-2222-4222-8222-222222222222',
      label: 'rice',
      componentRef: { section: 'food_components' as const, field: 'main_item' as const, value: 'rice' },
      hint: { kind: 'center' as const, center: { x: 0.24, y: 0.68 } },
      visibility: 'visible' as const,
    }
    mockLoadSpatial.mockResolvedValue({
      version: 1,
      imageId: sourceImageId,
      naturalWidth: 1,
      naturalHeight: 1,
      elements: [parentElement],
      extractedAt: '2026-01-01T00:00:00.000Z',
      extractorVersion: 'test',
    })
    mockMatchSpatial.mockReturnValue({ matched: true, element: parentElement, score: 1 })
    mockPersistSpatial.mockRejectedValue(new Error('spatial unavailable'))

    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect((await response.json()).imageId).toBe('child-image-id')
  })
  it('does not require an operation-control release decision for Remove', async () => {
    const response = await POST(request(validBody))

    expect(response.status).toBe(200)
    expect(mockLoadOwnedDishSource).toHaveBeenCalled()
    expect(mockMutate).toHaveBeenCalled()
  })
})

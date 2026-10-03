const mockGenerateImage = jest.fn()
const mockReferenceLimitForModel = jest.fn()

jest.mock('../../nano-banana', () => {
  const actual = jest.requireActual('../../nano-banana')
  return {
    ...actual,
    getNanoBananaClient: () => ({ generateImage: mockGenerateImage }),
  }
})

jest.mock('../../studio/model-config', () => {
  const actual = jest.requireActual('../../studio/model-config')
  return {
    ...actual,
    referenceLimitForModel: (...args: unknown[]) => mockReferenceLimitForModel(...args),
  }
})

import sharp from 'sharp'
import { MutationEngine } from '../mutation-engine'

/** 1×1 PNG. Sharp can read it, and it already fits a matching source. */
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('MutationEngine vessel reference on the customer path', () => {
  beforeEach(() => {
    mockReferenceLimitForModel.mockReset()
    mockReferenceLimitForModel.mockReturnValue(10)
    mockGenerateImage.mockReset()
    mockGenerateImage.mockResolvedValue({
      images: ['generated-image'],
      metadata: { providerModelIdentity: 'gemini-3.1-flash-image-001' },
    })
  })

  it('forwards the source and the replacement vessel, and still drops style references', async () => {
    await new MutationEngine().mutate({
      request_scope: 'studio_foh_mutation',
      sourceImageBase64: TINY_PNG,
      mimeType: 'image/png',
      prompt: 'Replace the plate.',
      styleReferences: [
        {
          data: TINY_PNG,
          mimeType: 'image/png',
          role: 'style',
          comment: 'lighting reference that must not be attached',
        },
      ],
      vesselReference: {
        data: TINY_PNG,
        mimeType: 'image/png',
        role: 'other',
        comment: 'Replacement vessel only (blue plate).',
      },
    })

    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({
        request_scope: 'studio_foh_mutation',
        aspect_ratio: '1:1',
        reference_images: [
          { mimeType: 'image/png', data: TINY_PNG, role: 'dish' },
          {
            mimeType: 'image/png',
            data: TINY_PNG,
            role: 'other',
            comment: 'Replacement vessel only (blue plate).',
          },
        ],
      }),
    )
  })

  it('locks the output ratio to the source photograph, not the vessel reference', async () => {
    const source = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 200, g: 180, b: 160 } },
    }).png().toBuffer()
    const vessel = await sharp({
      create: { width: 40, height: 90, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    }).png().toBuffer()

    await new MutationEngine().mutate({
      request_scope: 'studio_foh_mutation',
      sourceImageBase64: source.toString('base64'),
      mimeType: 'image/png',
      prompt: 'Move the food onto the replacement plate.',
      vesselReference: {
        data: vessel.toString('base64'),
        mimeType: 'image/png',
        role: 'other',
        comment: 'Replacement vessel only.',
      },
    })

    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ aspect_ratio: '3:2' }),
    )
  })

  it('keeps an explicit aspect ratio instead of snapping the source', async () => {
    const source = await sharp({
      create: { width: 300, height: 200, channels: 3, background: { r: 10, g: 10, b: 10 } },
    }).png().toBuffer()

    await new MutationEngine().mutate({
      request_scope: 'studio_foh_mutation',
      sourceImageBase64: source.toString('base64'),
      mimeType: 'image/png',
      prompt: 'Expand the scene.',
      aspectRatio: '4:5',
    })

    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ aspect_ratio: '4:5' }),
    )
  })
})

import {
  executeStudioGeneration,
  resolveRequestedStudioModel,
  type NormalizedGeneratedImage,
} from '../generation-executor'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '../model-config'

describe('Studio generation executor compatibility seam', () => {
  it('keeps the legacy Studio model fallback contract available to future routes', () => {
    expect(resolveRequestedStudioModel(undefined)).toBe(STUDIO_FLASH_MODEL)
    expect(resolveRequestedStudioModel('not-a-studio-model')).toBe(STUDIO_FLASH_MODEL)
    expect(resolveRequestedStudioModel(STUDIO_PRO_MODEL)).toBe(STUDIO_PRO_MODEL)
  })

  it('normalizes provider output, builds metadata, and finalizes in established order', async () => {
    const events: string[] = []
    const providerResult: NormalizedGeneratedImage = {
      imageBase64: 'generated-image',
      mimeType: 'image/png',
      providerMimeType: 'image/png',
      providerModelIdentity: 'gemini-provider-id',
    }

    const result = await executeStudioGeneration({
      userId: 'user-1',
      dishId: 'dish-1',
      requestedModel: STUDIO_FLASH_MODEL,
      creditCost: 1,
      providerInput: { sourceImageId: 'source-1' },
      invokeProvider: async (input) => {
        events.push(`provider:${input.sourceImageId}`)
        return providerResult
      },
      buildMetadata: (image) => {
        events.push(`metadata:${image.providerModelIdentity}`)
        return { sourceImageId: 'source-1' }
      },
      finalize: async (input) => {
        events.push(`finalize:${input.metadata.sourceImageId}`)
        return { imageId: 'generated-1', providerResult: input.providerResult }
      },
    })

    expect(events).toEqual([
      'provider:source-1',
      'metadata:gemini-provider-id',
      'finalize:source-1',
    ])
    expect(result).toEqual({ imageId: 'generated-1', providerResult })
  })
})

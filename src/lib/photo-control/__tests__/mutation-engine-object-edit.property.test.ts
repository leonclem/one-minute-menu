const mockGenerateImage = jest.fn()
const mockReferenceLimitForModel = jest.fn()

jest.mock('../../nano-banana', () => {
  const actual = jest.requireActual('../../nano-banana')
  return { ...actual, getNanoBananaClient: () => ({ generateImage: mockGenerateImage }) }
})
jest.mock('../../studio/model-config', () => {
  const actual = jest.requireActual('../../studio/model-config')
  return { ...actual, referenceLimitForModel: (...args: unknown[]) => mockReferenceLimitForModel(...args) }
})

import fc from 'fast-check'
import { MutationEngine } from '../mutation-engine'

describe('object-edit MutationEngine isolation properties', () => {
  beforeEach(() => {
    mockReferenceLimitForModel.mockReset()
    mockReferenceLimitForModel.mockReturnValue(10)
    mockGenerateImage.mockReset()
    mockGenerateImage.mockResolvedValue({ images: ['generated'], metadata: { providerModelIdentity: null } })
  })

  it('Property 13: object edit accepts exactly clean/annotation references, rejects injected references, and retains legacy source-only behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { minLength: 2, maxLength: 50 }).map((characters) => characters.join('')),
        fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { minLength: 2, maxLength: 50 }).map((characters) => characters.join('')),
        fc.boolean(),
        async (source, annotation, injectedSteering) => {
          const engine = new MutationEngine()
          await engine.mutate({
            request_scope: 'studio_object_edit',
            sourceImageBase64: source,
            mimeType: 'image/png',
            prompt: 'Object-edit instruction',
            annotationReference: { data: annotation, mimeType: 'image/png' },
          })
          expect(mockGenerateImage).toHaveBeenLastCalledWith(expect.objectContaining({
            request_scope: 'studio_object_edit',
            reference_images: [
              { mimeType: 'image/png', data: source, role: 'dish' },
              { mimeType: 'image/png', data: annotation, role: 'other' },
            ],
          }))

          mockGenerateImage.mockClear()
          await expect(engine.mutate({
            request_scope: 'studio_object_edit',
            sourceImageBase64: source,
            mimeType: 'image/png',
            prompt: 'Object-edit instruction',
            annotationReference: { data: annotation, mimeType: 'image/png' },
            ...(injectedSteering ? { includeSteeringImages: true } : { styleReferences: [] }),
          } as unknown as Parameters<MutationEngine['mutate']>[0])).rejects.toMatchObject({ code: 'INVALID_PARAMS', status: 400 })
          expect(mockGenerateImage).not.toHaveBeenCalled()

          await engine.mutate({
            request_scope: 'studio_foh_mutation',
            sourceImageBase64: source,
            mimeType: 'image/png',
            prompt: 'Legacy instruction',
            includeSteeringImages: true,
          })
          expect(mockGenerateImage).toHaveBeenLastCalledWith(expect.objectContaining({
            request_scope: 'studio_foh_mutation',
            reference_images: [{ mimeType: 'image/png', data: source, role: 'dish' }],
          }))
        },
      ),
      { numRuns: 100 },
    )
  })
})

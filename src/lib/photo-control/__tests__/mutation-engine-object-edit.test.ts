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

import { NanoBananaError } from '../../nano-banana'
import { MutationEngine } from '../mutation-engine'

const SOURCE = 'Y2xlYW4tc291cmNl'
const ANNOTATION = 'YW5ub3RhdGVkLXJlZmVyZW5jZQ=='

describe('MutationEngine studio_object_edit scope', () => {
  beforeEach(() => {
    mockReferenceLimitForModel.mockReset()
    mockReferenceLimitForModel.mockReturnValue(10)
    mockGenerateImage.mockReset()
    mockGenerateImage.mockResolvedValue({
      images: ['generated-image'],
      metadata: { providerModelIdentity: 'gemini-3.1-flash-image-001' },
    })
  })

  it('requires and forwards exactly clean Image A then annotated Image B without style or steering references', async () => {
    const output = await new MutationEngine().mutate({
      request_scope: 'studio_object_edit',
      sourceImageBase64: SOURCE,
      mimeType: 'image/png',
      prompt: 'Image A is clean. Image B is guidance only.',
      annotationReference: { data: ANNOTATION, mimeType: 'image/png' },
    })

    expect(mockGenerateImage).toHaveBeenCalledWith(expect.objectContaining({
      request_scope: 'studio_object_edit',
      reference_images: [
        { mimeType: 'image/png', data: SOURCE, role: 'dish' },
        { mimeType: 'image/png', data: ANNOTATION, role: 'other' },
      ],
    }))
    expect(output).toEqual({
      imageBase64: 'generated-image',
      mimeType: null,
      providerMimeType: null,
      thoughtSignature: undefined,
      providerModelIdentity: 'gemini-3.1-flash-image-001',
    })
  })

  it('rejects style or steering references injected into the isolated object-edit scope', async () => {
    const engine = new MutationEngine()
    await expect(engine.mutate({
      request_scope: 'studio_object_edit',
      sourceImageBase64: SOURCE,
      mimeType: 'image/png',
      prompt: 'Instruction',
      annotationReference: { data: ANNOTATION, mimeType: 'image/png' },
      styleReferences: [],
      includeSteeringImages: true,
    } as unknown as Parameters<MutationEngine['mutate']>[0])).rejects.toMatchObject({
      code: 'INVALID_PARAMS',
      status: 400,
    })
    expect(mockGenerateImage).not.toHaveBeenCalled()
  })

  it('fails closed when the selected model cannot carry both required references', async () => {
    mockReferenceLimitForModel.mockReturnValue(1)

    await expect(new MutationEngine().mutate({
      request_scope: 'studio_object_edit',
      sourceImageBase64: SOURCE,
      mimeType: 'image/png',
      prompt: 'Instruction',
      annotationReference: { data: ANNOTATION, mimeType: 'image/png' },
    })).rejects.toBeInstanceOf(NanoBananaError)
    expect(mockGenerateImage).not.toHaveBeenCalled()
  })
})

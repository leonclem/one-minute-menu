import { buildGeminiRequest, NanoBananaClient } from '../nano-banana'
import { fetchJsonWithRetry } from '../retry'

jest.mock('../retry', () => ({
  fetchJsonWithRetry: jest.fn(),
  HttpError: class MockHttpError extends Error {
    status: number
    constructor(message: string, status: number) {
      super(message)
      this.status = status
    }
  },
}))

const mockFetchJsonWithRetry = fetchJsonWithRetry as jest.MockedFunction<typeof fetchJsonWithRetry>
const OPTIONS = {
  apiKey: 'object-edit-test-key',
  baseUrl: 'https://api.test.nanobanana.com/v1/generateContent',
}
const INSTRUCTION = [
  'Image A is the current clean source image to edit.',
  'Image B is guidance only and must not appear in the output.',
].join('\n')

describe('NanoBanana object-edit provider contract', () => {
  it('emits only the supported Gemini fields with one instruction followed by Image A and Image B', () => {
    const request = buildGeminiRequest({
      prompt: INSTRUCTION,
      model: 'gemini-3.1-flash-image',
      number_of_images: 1,
      person_generation: 'allow',
      safety_filter_level: 'block_some',
      image_size: '2K',
      thinking_level: 'high',
      request_scope: 'studio_object_edit',
      reference_images: [
        { mimeType: 'image/png', data: 'Y2xlYW4=', role: 'dish' },
        { mimeType: 'image/png', data: 'YW5ub3RhdGVk', role: 'other' },
      ],
    }, OPTIONS)

    expect(Object.keys(request.requestBody)).toEqual(['contents', 'generationConfig'])
    expect(request.loggedPrompt).toBe(INSTRUCTION)
    expect(request.loggedPrompt).not.toContain('Edit the provided')
    expect(request.requestBody).toEqual({
      contents: [{
        role: 'user',
        parts: [
          { text: INSTRUCTION },
          { inlineData: { mimeType: 'image/png', data: 'Y2xlYW4=' } },
          { inlineData: { mimeType: 'image/png', data: 'YW5ub3RhdGVk' } },
        ],
      }],
      generationConfig: {
        candidateCount: 1,
        responseModalities: ['IMAGE'],
        imageConfig: { imageSize: '2K' },
        thinkingConfig: { thinkingLevel: 'HIGH' },
      },
    })
  })

  it('normalizes raw Gemini image data and keeps provider model identity server-only with an explicit absence', async () => {
    const client = new NanoBananaClient('object-edit-test-key')
    mockFetchJsonWithRetry.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'generated-one', mimeType: 'image/jpeg' } }] } }],
      metadata: { model_version: 'gemini-3.1-flash-image-001', processing_time_ms: 8 },
    })

    const identified = await client.generateImage({ prompt: INSTRUCTION, request_scope: 'studio_object_edit' })
    expect(identified).toEqual({
      images: ['generated-one'],
      imageMimeTypes: ['image/jpeg'],
      metadata: {
        processingTime: 8,
        modelVersion: 'gemini-3.1-flash-image-001',
        providerModelIdentity: 'gemini-3.1-flash-image-001',
        safetyFilterApplied: undefined,
        filterReason: undefined,
      },
    })

    mockFetchJsonWithRetry.mockResolvedValueOnce({
      candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'generated-two' } }] } }],
      metadata: {},
    })
    const absent = await client.generateImage({ prompt: INSTRUCTION, request_scope: 'studio_object_edit' })
    expect(absent.metadata.modelVersion).toBe('gemini-3.1-flash-image')
    expect(absent.metadata.providerModelIdentity).toBeNull()
    expect(absent.imageMimeTypes).toEqual([null])
  })
})

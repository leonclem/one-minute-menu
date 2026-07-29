/**
 * Bug-condition exploration for Studio request defects.
 *
 * Feature: studio-json-metadata-defects, Property 1: Input-Matched Output Dimensions
 * **Validates: Requirements 2.1, 2.2, 3.1**
 */

import fc from 'fast-check'
import { MutationEngine, type MutationInput, type StyleReferenceImage } from '../mutation-engine'
import { buildGeminiRequest, NanoBananaClient } from '../../nano-banana'
import { STUDIO_FLASH_MODEL } from '../../studio/model-config'
import { fetchJsonWithRetry } from '../../retry'
import { logger } from '../../logger'

jest.mock('../../retry', () => ({
  fetchJsonWithRetry: jest.fn(),
  HttpError: class MockHttpError extends Error {
    status: number

    constructor(message: string, status: number) {
      super(message)
      this.name = 'HttpError'
      this.status = status
    }
  },
}))

const mockFetchJsonWithRetry = fetchJsonWithRetry as jest.MockedFunction<typeof fetchJsonWithRetry>
const TEST_API_KEY = 'studio-request-defects-key'
const TEST_BASE_URL = 'https://api.test.nanobanana.com/v1/generateContent'
const GENERATION_RESPONSE = {
  candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'mutated-image' } }] } }],
  metadata: { processing_time_ms: 1, model_version: 'gemini-3.1-flash-image-preview' },
}

type CapturedRequestBody = {
  contents: Array<{ parts: Array<{ text?: string }> }>
  generationConfig: {
    imageConfig: Record<string, unknown>
    thinkingConfig?: { thinkingLevel?: string }
  }
}

function capturedRequestBody(): CapturedRequestBody {
  const [, init] = mockFetchJsonWithRetry.mock.calls.at(-1) as [string, RequestInit]
  return JSON.parse(init.body as string) as CapturedRequestBody
}

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

function styleReference(key: string): StyleReferenceImage {
  return {
    data: TINY_PNG_BASE64,
    mimeType: 'image/png',
    role: key === 'backdrop' ? 'scene' : 'style',
    comment: `${key} staged style`,
  }
}

function studioMutationInput(input: MutationInput): MutationInput {
  return { ...input, request_scope: 'studio_foh_mutation' }
}

async function captureStudioRequest(
  input: MutationInput,
  customerFoh = true,
): Promise<CapturedRequestBody> {
  mockFetchJsonWithRetry.mockClear()
  mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)

  await new MutationEngine().mutate(customerFoh ? studioMutationInput(input) : input)
  return capturedRequestBody()
}

async function captureSandboxRequest(input: MutationInput): Promise<CapturedRequestBody> {
  return captureStudioRequest(input, false)
}

const sourceDimensionsArbitrary = fc.oneof(
  fc.constant({ width: 1024, height: 612 }),
  fc.record({
    width: fc.integer({ min: 1, max: 4096 }),
    height: fc.integer({ min: 1, max: 4096 }),
  }),
)

const studioMutationArbitrary = fc.record({
  source: sourceDimensionsArbitrary,
  personSetting: fc.constantFrom('allow', 'dont_allow'),
  safetySetting: fc.constantFrom('block_none', 'block_some', 'block_most'),
  stagedStyles: fc.subarray(['lighting', 'backdrop', 'surface']),
})

describe('Studio request defects: forced square', () => {
  beforeEach(() => {
    process.env.NANO_BANANA_API_KEY = TEST_API_KEY
    process.env.NANO_BANANA_BASE_URL = TEST_BASE_URL
    mockFetchJsonWithRetry.mockReset()
    mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)
  })

  it('does not force the reproducible 1024×612 Studio edit to square through client defaults', async () => {
    const request = await captureStudioRequest({
      sourceImageBase64: Buffer.from('source-1024x612').toString('base64'),
      mimeType: 'image/jpeg',
      prompt: 'Edit the 1024×612 source while preserving the plated dish.',
      styleReferences: ['lighting', 'backdrop', 'surface'].map(styleReference),
    })

    expect(request.generationConfig.imageConfig).not.toHaveProperty('aspectRatio')
    expect(request.contents[0].parts[0].text).not.toContain('Aspect ratio:')
  })

  it('does not apply a 1:1 fallback when the request builder receives no aspect_ratio', () => {
    const request = buildGeminiRequest({
      prompt: 'Edit the original photograph without recomposing its canvas.',
      person_generation: 'dont_allow',
      safety_filter_level: 'block_some',
      request_scope: 'studio_foh_mutation',
    })
    const requestBody = request.requestBody as unknown as CapturedRequestBody
    const prompt = requestBody.contents[0].parts[0].text as string
    const imageConfig = (request.requestBody.generationConfig as { imageConfig: Record<string, unknown> }).imageConfig

    expect(imageConfig).not.toHaveProperty('aspectRatio')
    expect(prompt).not.toContain('Aspect ratio:')
  })

  it('isolates the corrected Studio contract from the unscoped legacy golden contract', () => {
    const baseParams = {
      prompt: 'Preserve the plated dish while adjusting the background.',
      model: 'gemini-3.1-flash-image',
      safety_filter_level: 'block_some' as const,
      person_generation: 'dont_allow' as const,
      thinking_level: 'high' as const,
      reference_images: [{
        mimeType: 'image/png' as const,
        data: 'c3ViamVjdA==',
        role: 'dish',
      }],
    }

    const legacy = buildGeminiRequest(baseParams).requestBody
    const studio = buildGeminiRequest({
      ...baseParams,
      request_scope: 'studio_foh_mutation',
    }).requestBody

    expect(legacy).toEqual({
      contents: [{
        role: 'user',
        parts: [
          {
            text: 'Generate an image of: Compose a new image using the provided reference inputs:\nUse Image A for the primary subject/dish. \nIntegrate the subject naturally into the environment while maintaining the requested style and layout.\n\nPreserve the plated dish while adjusting the background.\nNo people in the image.\nContent safety: block_some',
          },
          { inlineData: { mimeType: 'image/png', data: 'c3ViamVjdA==' } },
        ],
      }],
      generationConfig: {
        candidateCount: 1,
        responseModalities: ['IMAGE'],
        imageConfig: { aspectRatio: '1:1', imageSize: '1k' },
      },
    })
    expect(studio).toEqual({
      contents: [{
        role: 'user',
        parts: [
          {
            text: 'Edit the provided reference images (Image A) while preserving their visual identity.\n\nPreserve the plated dish while adjusting the background.\nNo people in the image.',
          },
          { inlineData: { mimeType: 'image/png', data: 'c3ViamVjdA==' } },
        ],
      }],
      generationConfig: {
        candidateCount: 1,
        responseModalities: ['IMAGE'],
        imageConfig: {},
        thinkingConfig: { thinkingLevel: 'HIGH' },
      },
    })
  })

  it('retains an explicitly supplied aspect_ratio for non-Studio callers', async () => {
    const client = new NanoBananaClient(TEST_API_KEY)
    await client.generateImage({
      prompt: 'Generate a deliberate widescreen menu image.',
      aspect_ratio: '16:9',
      person_generation: 'allow',
      safety_filter_level: 'block_none',
    })

    const request = capturedRequestBody()
    expect(request.generationConfig.imageConfig.aspectRatio).toBe('16:9')
    expect(request.contents[0].parts[0].text).toContain('Aspect ratio: 16:9')
  })

  it('omits implicit aspect ratio constraints for all Studio source dimensions and staged-style subsets', async () => {
    await fc.assert(
      fc.asyncProperty(studioMutationArbitrary, async ({ source, personSetting, safetySetting, stagedStyles }) => {
        const request = await captureStudioRequest({
          sourceImageBase64: Buffer.from(`source-${source.width}x${source.height}`).toString('base64'),
          mimeType: 'image/jpeg',
          prompt: `Edit a ${source.width}x${source.height} source; requested controls: person=${personSetting}, safety=${safetySetting}.`,
          styleReferences: stagedStyles.map(styleReference),
        })

        expect(request.generationConfig.imageConfig).not.toHaveProperty('aspectRatio')
        expect(request.contents[0].parts[0].text).not.toContain('Aspect ratio:')
      }),
      { numRuns: 50 },
    )
  })
})


/**
 * Feature: studio-json-metadata-defects, Property 3: Thinking Level Reaches The API
 * **Validates: Requirements 2.4, 3.3**
 */
const flashFamilyModelArbitrary = fc.oneof(
  fc.constant('gemini-3.1-flash-image-preview'),
  fc.constant('gemini-3.1-flash-image'),
  fc
    .tuple(
      fc.constantFrom('gemini-2.5', 'gemini-3', 'gemini-3.1'),
      fc.constantFrom('flash', 'flash-image', 'flash-image-preview'),
    )
    .map(([generation, variant]) => `${generation}-${variant}`),
)

describe('Studio request defects: thinking level discarded', () => {
  const originalThinkingLevel = process.env.STUDIO_THINKING_LEVEL
  const originalStudioImageSize = process.env.STUDIO_IMAGE_SIZE

  beforeEach(() => {
    delete process.env.STUDIO_THINKING_LEVEL
    delete process.env.STUDIO_IMAGE_SIZE
  })

  afterAll(() => {
    if (originalThinkingLevel === undefined) {
      delete process.env.STUDIO_THINKING_LEVEL
    } else {
      process.env.STUDIO_THINKING_LEVEL = originalThinkingLevel
    }
    if (originalStudioImageSize === undefined) {
      delete process.env.STUDIO_IMAGE_SIZE
    } else {
      process.env.STUDIO_IMAGE_SIZE = originalStudioImageSize
    }
  })

  it('sets HIGH for every Flash-family model when thinking_level is high', () => {
    fc.assert(
      fc.property(flashFamilyModelArbitrary, (model) => {
        const request = buildGeminiRequest({
          prompt: 'Preserve the source dish while applying the requested edit.',
          model,
          thinking_level: 'high',
          request_scope: 'studio_foh_mutation',
        })
        const generationConfig = request.requestBody.generationConfig as {
          thinkingConfig?: { thinkingLevel?: string }
        }

        expect(generationConfig.thinkingConfig?.thinkingLevel).toBe('HIGH')
      }),
      { numRuns: 50 },
    )
  })

  it('defaults the configured Studio thinking level to high when STUDIO_THINKING_LEVEL is unset', async () => {
    const request = await captureStudioRequest({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: 'Edit the source photograph without changing the plated dish.',
      model: 'gemini-3.1-flash-image-preview',
    })

    expect(request.generationConfig.thinkingConfig?.thinkingLevel).toBe('HIGH')
  })

  it('uses the configured thinking level and image size with the shared default Studio model', async () => {
    process.env.STUDIO_THINKING_LEVEL = 'minimal'
    process.env.STUDIO_IMAGE_SIZE = '4k'

    const request = await captureStudioRequest({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: 'Use the configured Flash generation controls.',
    })
    const [url] = mockFetchJsonWithRetry.mock.calls.at(-1) as [string, RequestInit]

    expect(request.generationConfig.thinkingConfig?.thinkingLevel).toBe('MINIMAL')
    expect(request.generationConfig.imageConfig).toEqual(expect.objectContaining({ imageSize: '4K' }))
    expect(request.generationConfig.imageConfig).not.toHaveProperty('aspectRatio')
    expect(url).toContain(`/models/${STUDIO_FLASH_MODEL}:generateContent`)
  })

  it('continues to omit thinkingLevel for Pro models', () => {
    const request = buildGeminiRequest({
      prompt: 'Generate a premium menu image.',
      model: 'gemini-3-pro-image',
      thinking_level: 'high',
      request_scope: 'studio_foh_mutation',
    })
    const generationConfig = request.requestBody.generationConfig as {
      thinkingConfig?: { thinkingLevel?: string }
    }

    expect(generationConfig).not.toHaveProperty('thinkingConfig')
  })
})


/**
 * Feature: studio-json-metadata-defects, Property 4: Log Fidelity, Edit Framing, No Leaked Config Tokens
 * **Validates: Requirements 2.6, 2.7, 2.8, 3.4**
 */
type OutboundRequestLog = {
  promptText: string
}

async function captureStudioOutboundRequest(
  input: MutationInput,
  loggerInfoSpy: jest.SpyInstance,
): Promise<{ request: CapturedRequestBody; loggedPrompt: string }> {
  mockFetchJsonWithRetry.mockClear()
  mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)

  await new MutationEngine().mutate(studioMutationInput(input))

  const outboundLogCall = [...loggerInfoSpy.mock.calls].reverse().find(
    ([message]) => message === '🎨 [Nano Banana] Outbound request',
  )
  if (!outboundLogCall) {
    throw new Error('Expected the Nano Banana outbound request to be logged.')
  }

  return {
    request: capturedRequestBody(),
    loggedPrompt: (outboundLogCall[1] as OutboundRequestLog).promptText,
  }
}

const arbitraryStudioRequest = fc.record({
  prompt: fc
    .tuple(fc.string({ maxLength: 239 }), fc.constantFrom('a', 'dish', 'edit'))
    .map(([prefix, requiredText]) => `${prefix}${requiredText}`),
  source: fc.uint8Array({ minLength: 1, maxLength: 64 }),
  stagedStyles: fc.subarray(['lighting', 'backdrop', 'surface']),
})

describe('Studio request defects: log divergence, synthesis framing, and leaked config tokens', () => {
  let loggerInfoSpy: jest.SpyInstance

  beforeEach(() => {
    process.env.NANO_BANANA_API_KEY = TEST_API_KEY
    process.env.NANO_BANANA_BASE_URL = TEST_BASE_URL
    mockFetchJsonWithRetry.mockReset()
    mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)
    loggerInfoSpy = jest.spyOn(logger, 'info').mockImplementation()
  })

  afterEach(() => {
    loggerInfoSpy.mockRestore()
  })

  it('keeps the log faithful, frames every Studio request as an edit, and excludes config tokens', async () => {
    await fc.assert(
      fc.asyncProperty(arbitraryStudioRequest, async ({ prompt, source, stagedStyles }) => {
        const { request, loggedPrompt } = await captureStudioOutboundRequest(
          {
            sourceImageBase64: Buffer.from(source).toString('base64'),
            mimeType: 'image/jpeg',
            prompt,
            styleReferences: stagedStyles.map(styleReference),
          },
          loggerInfoSpy,
        )
        const sentText = request.contents[0].parts[0].text as string

        expect({
          loggedPromptMatchesSentText: loggedPrompt === sentText,
          excludesGenerateImagePrefix: !sentText.includes('Generate an image of:'),
          excludesComposeNewImageFraming: !sentText.includes('Compose a new image'),
          excludesContentSafetyToken: !sentText.includes('Content safety:'),
          retainsImageLabel: sentText.includes('Image A'),
          retainsNoPeopleInstruction: sentText.includes('No people in the image.'),
        }).toEqual({
          loggedPromptMatchesSentText: true,
          excludesGenerateImagePrefix: true,
          excludesComposeNewImageFraming: true,
          excludesContentSafetyToken: true,
          retainsImageLabel: true,
          retainsNoPeopleInstruction: true,
        })
      }),
      { numRuns: 50 },
    )
  })
})


/**
 * Feature: studio-json-metadata-defects, Property 5: No Reference May Dwarf The Subject
 * **Validates: Requirements 2.10**
 *
 * This is an exploration test and is intentionally expected to fail until the
 * reference-image fit stage exists. It exercises MutationEngine through the
 * real NanoBananaClient request assembly, with only network transport mocked.
 */
type ReferenceFitMetrics = {
  pixelArea: number
  bytes: number
}

type CapturedInlineImagePart = {
  inlineData: {
    mimeType: string
    data: string
  }
}

function capturedInlineImages(request: CapturedRequestBody): CapturedInlineImagePart[] {
  return (request.contents[0].parts as unknown as Array<{ inlineData?: CapturedInlineImagePart['inlineData'] }>)
    .filter((part): part is CapturedInlineImagePart => part.inlineData !== undefined)
}

function subjectWasNotDownscaled(request: CapturedRequestBody, source: Buffer): boolean {
  const outboundSource = capturedInlineImages(request)[0]
  return outboundSource !== undefined && Buffer.from(outboundSource.inlineData.data, 'base64').equals(source)
}

function referenceWasRejectedAndLogged(
  request: CapturedRequestBody,
  referenceData: string,
  loggerWarnSpy: jest.SpyInstance,
): boolean {
  const referenceWasAttached = capturedInlineImages(request).some(
    (part) => part.inlineData.data === referenceData,
  )
  const hasReferenceWarning = loggerWarnSpy.mock.calls.some((call) =>
    call.some((argument: unknown) => String(argument).toLowerCase().includes('reference')),
  )

  return !referenceWasAttached && hasReferenceWarning
}

const oversizedReferencePairArbitrary = fc
  .record({
    subjectPixelArea: fc.integer({ min: 1, max: 1_048_576 }),
    referencePixelAreaIncrease: fc.integer({ min: 1, max: 1_048_576 }),
    subjectBytes: fc.integer({ min: 1, max: 8_192 }),
    referenceByteIncrease: fc.integer({ min: 1, max: 8_192 }),
  })
  .map(({ subjectPixelArea, referencePixelAreaIncrease, subjectBytes, referenceByteIncrease }) => ({
    subject: { pixelArea: subjectPixelArea, bytes: subjectBytes },
    reference: {
      pixelArea: subjectPixelArea + referencePixelAreaIncrease,
      bytes: subjectBytes + referenceByteIncrease,
    },
  }))

async function captureReferenceFitRequest(source: Buffer, reference: Buffer): Promise<CapturedRequestBody> {
  return captureSandboxRequest({
    sourceImageBase64: source.toString('base64'),
    mimeType: 'image/jpeg',
    prompt: 'Preserve the subject while applying the staged studio reference.',
    styleReferences: [
      {
        data: reference.toString('base64'),
        mimeType: 'image/png',
        role: 'scene',
        comment: 'Oversized staged backdrop reference.',
      },
    ],
  })
}

describe('Studio request defects: reference dwarfing the subject', () => {
  let loggerWarnSpy: jest.SpyInstance

  beforeEach(() => {
    process.env.NANO_BANANA_API_KEY = TEST_API_KEY
    process.env.NANO_BANANA_BASE_URL = TEST_BASE_URL
    mockFetchJsonWithRetry.mockReset()
    mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation()
  })

  afterEach(() => {
    loggerWarnSpy.mockRestore()
  })

  it('rejects or fits the recorded 2404×2126, 3,988 KB studio-yellow backdrop against the 434 KB subject without downscaling the subject', async () => {
    // The source values are the archived pre-change Studio capture: 1024×612 and 434,718 bytes.
    // Its binary is intentionally represented by its recorded byte payload because this test captures
    // request assembly rather than calling the external model.
    const source = Buffer.alloc(434_718, 0x53)
    const backdropPath = require('path').join(
      process.cwd(),
      'public',
      'studio',
      'backdrops',
      'backdrop-studio-yellow.png',
    )
    const backdrop = require('fs').readFileSync(backdropPath) as Buffer
    const backdropMetadata = await require('sharp')(backdrop).metadata()
    const subject: ReferenceFitMetrics = { pixelArea: 1024 * 612, bytes: source.length }
    const reference: ReferenceFitMetrics = {
      pixelArea: backdropMetadata.width * backdropMetadata.height,
      bytes: backdrop.length,
    }

    expect({ width: backdropMetadata.width, height: backdropMetadata.height, bytes: backdrop.length }).toEqual({
      width: 2404,
      height: 2126,
      bytes: 4_083_924,
    })

    const request = await captureReferenceFitRequest(source, backdrop)
    const referenceFitsSubject =
      reference.pixelArea <= subject.pixelArea && reference.bytes <= subject.bytes
    const rejectedAndLogged = referenceWasRejectedAndLogged(request, backdrop.toString('base64'), loggerWarnSpy)

    expect({
      subjectWasNotDownscaled: subjectWasNotDownscaled(request, source),
      styleReferenceWasFittedOrRejectedAndLogged: referenceFitsSubject || rejectedAndLogged,
    }).toEqual({
      subjectWasNotDownscaled: true,
      styleReferenceWasFittedOrRejectedAndLogged: true,
    })
  })

  it('never attaches a generated oversized style reference unless it fits the generated subject or is rejected and logged', async () => {
    await fc.assert(
      fc.asyncProperty(oversizedReferencePairArbitrary, async ({ subject, reference }) => {
        const source = Buffer.alloc(subject.bytes, 0x53)
        const oversizedReference = Buffer.alloc(reference.bytes, 0x52)
        const request = await captureReferenceFitRequest(source, oversizedReference)
        const referenceFitsSubject =
          reference.pixelArea <= subject.pixelArea && reference.bytes <= subject.bytes
        const rejectedAndLogged = referenceWasRejectedAndLogged(
          request,
          oversizedReference.toString('base64'),
          loggerWarnSpy,
        )

        expect({
          subjectWasNotDownscaled: subjectWasNotDownscaled(request, source),
          styleReferenceWasFittedOrRejectedAndLogged: referenceFitsSubject || rejectedAndLogged,
        }).toEqual({
          subjectWasNotDownscaled: true,
          styleReferenceWasFittedOrRejectedAndLogged: true,
        })
      }),
      { numRuns: 50 },
    )
  })
})


/**
 * Feature: studio-json-metadata-defects, Property 2: No Silent Drop On Multi-Reference Paths (A2b)
 * **Validates: Requirements 2.3, 2.3a, 3.3**
 *
 * This exploration deliberately excludes the customer FOH source-only behaviour
 * from Task 14. It covers admin-sandbox-like engine calls, explicit steering
 * opt-in, Pro routing, and direct non-Studio NanoBananaClient callers.
 */
type CapturedReferenceImage = {
  inlineData: {
    mimeType: string
    data: string
  }
}

const FLASH_PREVIEW_MODEL = 'gemini-3.1-flash-image-preview'
const PRO_MODEL = 'gemini-3-pro-image'

function capturedReferenceImages(request: CapturedRequestBody): CapturedReferenceImage[] {
  return (request.contents[0].parts as unknown as Array<{ inlineData?: CapturedReferenceImage['inlineData'] }>)
    .filter((part): part is CapturedReferenceImage => part.inlineData !== undefined)
}

function steeringImageData(): string[] {
  const assetsDir = require('path').join(process.cwd(), 'src', 'assets', 'photo-control')
  return ['steering-angle-table.png', 'steering-angle-diagram.png'].map((fileName) =>
    require('fs').readFileSync(require('path').join(assetsDir, fileName)).toString('base64'),
  )
}

function attachedSteeringCount(request: CapturedRequestBody): number {
  const steeringData = new Set(steeringImageData())
  return capturedReferenceImages(request).filter((image) => steeringData.has(image.inlineData.data)).length
}

function numberedStyleReferences(prefix: string, count: number): StyleReferenceImage[] {
  return Array.from({ length: count }, (_, index) => styleReference(`${prefix}-${index + 1}`))
}

function nonStudioReferences(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    mimeType: 'image/png' as const,
    data: Buffer.from(`non-studio-reference-${index + 1}`).toString('base64'),
    role: 'other',
    comment: `non-Studio reference ${index + 1}`,
  }))
}

const optedInA2bReferenceSetArbitrary = fc.record({
  model: fc.constantFrom(FLASH_PREVIEW_MODEL, PRO_MODEL),
  styleReferences: fc.subarray(
    ['lighting', 'backdrop', 'surface'],
    { minLength: 1, maxLength: 3 },
  ),
})

describe('Studio request defects: reference limits and explicit steering opt-in (A2b only)', () => {
  let loggerWarnSpy: jest.SpyInstance

  beforeEach(() => {
    process.env.NANO_BANANA_API_KEY = TEST_API_KEY
    process.env.NANO_BANANA_BASE_URL = TEST_BASE_URL
    mockFetchJsonWithRetry.mockReset()
    mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)
    loggerWarnSpy = jest.spyOn(logger, 'warn').mockImplementation()
  })

  afterEach(() => {
    loggerWarnSpy.mockRestore()
  })

  it('leaves steering references off by default regardless of remaining cap capacity', async () => {
    const requests = await Promise.all([0, 1, 2, 3].map((styleCount) => captureSandboxRequest({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: 'Sandbox request without an explicit steering opt-in.',
      styleReferences: numberedStyleReferences('default-off', styleCount),
    })))

    expect(requests.map(attachedSteeringCount)).toEqual([0, 0, 0, 0])
  })

  it('uses the same documented 10-reference limit for the Flash-preview engine path and a direct non-Studio caller', async () => {
    const engineRequest = await captureSandboxRequest({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: 'Admin sandbox request with nine selected style references.',
      model: FLASH_PREVIEW_MODEL,
      styleReferences: numberedStyleReferences('sandbox-limit', 9),
    })

    const directClient = new NanoBananaClient(TEST_API_KEY)
    await directClient.generateImage({
      prompt: 'Direct non-Studio caller with ten references.',
      model: FLASH_PREVIEW_MODEL,
      reference_images: nonStudioReferences(10),
    })
    const directClientRequest = capturedRequestBody()

    await expect(
      directClient.generateImage({
        prompt: 'Direct non-Studio caller exceeding the documented limit.',
        model: FLASH_PREVIEW_MODEL,
        reference_images: nonStudioReferences(11),
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PARAMS' })

    expect({
      mutationEngineReferenceCount: capturedReferenceImages(engineRequest).length,
      directClientReferenceCount: capturedReferenceImages(directClientRequest).length,
    }).toEqual({
      mutationEngineReferenceCount: 10,
      directClientReferenceCount: 10,
    })
  })

  it('warns with the name of every reference dropped from an over-cap admin sandbox request', async () => {
    const styleReferences = numberedStyleReferences('sandbox-dropped-reference', 14)
    const request = await captureSandboxRequest({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: 'Over-cap admin sandbox request must make each drop observable.',
      model: FLASH_PREVIEW_MODEL,
      styleReferences,
    })
    const droppedReferenceNames = styleReferences.slice(9).map((reference) => reference.comment as string)
    const warningText = loggerWarnSpy.mock.calls.map((call) => JSON.stringify(call)).join('\n')

    expect(capturedReferenceImages(request)).toHaveLength(10)
    for (const referenceName of droppedReferenceNames) {
      expect(warningText).toContain(referenceName)
    }
  })

  it('uses referenceLimitForModel as the engine and client shared cap definition', () => {
    const sharedModelConfig = require('../../studio/model-config') as {
      referenceLimitForModel: (model: string) => number
      documentedLimit: (model: string) => number
    }

    expect(sharedModelConfig.referenceLimitForModel(FLASH_PREVIEW_MODEL)).toBe(
      sharedModelConfig.documentedLimit(FLASH_PREVIEW_MODEL),
    )
  })

  it('counts source, all attached style references, and explicitly opted-in steering images across sandbox and Pro routes', async () => {
    await fc.assert(
      fc.asyncProperty(optedInA2bReferenceSetArbitrary, async ({ model, styleReferences }) => {
        const request = await captureSandboxRequest({
          sourceImageBase64: TINY_PNG_BASE64,
          mimeType: 'image/png',
          prompt: 'Explicitly opted-in sandbox or Pro steering request.',
          model,
          styleReferences: styleReferences.map(styleReference),
          includeSteeringImages: true,
        })

        expect(capturedReferenceImages(request)).toHaveLength(1 + styleReferences.length + 2)
      }),
      { numRuns: 50 },
    )
  })

  it('does not attach steering-angle references for a Pro request without an explicit opt-in', async () => {
    const request = await captureSandboxRequest({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: 'Pro routing without a steering opt-in.',
      model: PRO_MODEL,
      includeSteeringImages: false,
    })

    expect(attachedSteeringCount(request)).toBe(0)
  })
})
/**
 * Feature: studio-json-metadata-defects, Property 2: Source-Only On The Customer Path (A2)
 * **Validates: Requirements 2.3b, 3.2**
 *
 * This property exercises the engine-level customer FOH reference invariant.
 * Descriptor attribute coverage is asserted by the scene-descriptor and route tests.
 */
type CustomerPathGenerationParams = Parameters<NanoBananaClient['generateImage']>[0]

async function captureCustomerPathRequest(
  stagedStyles: string[],
): Promise<{ request: CapturedRequestBody; params: CustomerPathGenerationParams }> {
  mockFetchJsonWithRetry.mockClear()
  mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)
  const generateImageSpy = jest.spyOn(NanoBananaClient.prototype, 'generateImage')

  try {
    await new MutationEngine().mutate(studioMutationInput({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: `Customer FOH edit with staged styles: ${stagedStyles.join(', ') || 'none'}.`,
      styleReferences: stagedStyles.map(styleReference),
    }))

    const params = generateImageSpy.mock.calls.at(-1)?.[0]
    if (!params) throw new Error('Expected the customer FOH generation call to be captured.')
    return { request: capturedRequestBody(), params }
  } finally {
    generateImageSpy.mockRestore()
  }
}

const customerStagedStylesArbitrary = fc.subarray(['lighting', 'backdrop', 'surface'])

describe('Studio request defects: source-only customer FOH references (A2)', () => {
  beforeEach(() => {
    process.env.NANO_BANANA_API_KEY = TEST_API_KEY
    process.env.NANO_BANANA_BASE_URL = TEST_BASE_URL
    mockFetchJsonWithRetry.mockReset()
    mockFetchJsonWithRetry.mockResolvedValue(GENERATION_RESPONSE)
  })

  it('keeps only the source reference regardless of staged style count', async () => {
    await fc.assert(
      fc.asyncProperty(customerStagedStylesArbitrary, async (stagedStyles) => {
        const { params } = await captureCustomerPathRequest(stagedStyles)
        const references = (params.reference_images || []) as Array<{ data: string; role?: string; label?: string }>

        expect({
          referenceCount: references.length,
          sourceIsFirstAndUnchanged: references[0]?.role === 'dish' && references[0]?.data === TINY_PNG_BASE64,
          allReferencesAreDish: references.every((reference) => reference.role === 'dish'),
          hasSteeringReference: references.some((reference) =>
            typeof reference.label === 'string' && reference.label.startsWith('steering-angle-'),
          ),
        }).toEqual({
          referenceCount: 1,
          sourceIsFirstAndUnchanged: true,
          allReferencesAreDish: true,
          hasSteeringReference: false,
        })
      }),
      { numRuns: 50 },
    )
  })

  it('preserves the source bytes for a concrete lighting + backdrop + surface request', async () => {
    const { params } = await captureCustomerPathRequest(['lighting', 'backdrop', 'surface'])
    const references = (params.reference_images || []) as Array<{ data: string; role?: string; label?: string }>

    expect({
      referenceCount: references.length,
      referenceRoles: references.map((reference) => reference.role),
      sourceBytesPreserved: references[0]?.data === TINY_PNG_BASE64,
    }).toEqual({
      referenceCount: 1,
      referenceRoles: ['dish'],
      sourceBytesPreserved: true,
    })
  })
})

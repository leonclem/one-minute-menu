import fc from 'fast-check'

import { NanoBananaError } from '@/lib/nano-banana'
import { StudioCreditsError } from '@/lib/studio/credits'
import { StudioDishBlockedError } from '@/lib/studio/generation-failures'
import { StudioImageLoadError } from '@/lib/studio/image-bytes'
import { mapStudioGenerationError } from '@/lib/studio/generation-request'
import { StudioGenerationErrorZ } from '../contracts'

beforeAll(() => {
  jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterAll(() => {
  jest.restoreAllMocks()
})

type ErrorScenario = 'policy' | 'rate-limit' | 'auth' | 'unavailable' | 'no-image' | 'invalid' | 'credits' | 'image' | 'blocked' | 'unknown'

function errorFor(scenario: ErrorScenario): { error: Error; status: number } {
  switch (scenario) {
    case 'policy': return { error: new NanoBananaError('Policy', 'CONTENT_POLICY_VIOLATION'), status: 403 }
    case 'rate-limit': return { error: new NanoBananaError('Rate limit', 'RATE_LIMIT_EXCEEDED'), status: 429 }
    case 'auth': return { error: new NanoBananaError('Authentication', 'AUTHENTICATION_ERROR'), status: 401 }
    case 'unavailable': return { error: new NanoBananaError('Unavailable', 'SERVICE_UNAVAILABLE'), status: 503 }
    case 'no-image': return { error: new NanoBananaError('No image', 'NO_IMAGE_PRODUCED'), status: 502 }
    case 'invalid': return { error: new NanoBananaError('Invalid', 'INVALID_PARAMS'), status: 400 }
    case 'credits': return { error: new StudioCreditsError('Credits', 'INSUFFICIENT_CREDITS', 402), status: 402 }
    case 'image': return { error: new StudioImageLoadError('Image not found', 404), status: 404 }
    case 'blocked': return { error: new StudioDishBlockedError('Blocked', 5), status: 423 }
    default: return { error: new Error('Internal'), status: 500 }
  }
}

describe('studio generation error mapping properties', () => {
  it('Property 15: known errors map to one established status/error envelope without internal data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<ErrorScenario>('policy', 'rate-limit', 'auth', 'unavailable', 'no-image', 'invalid', 'credits', 'image', 'blocked', 'unknown'),
        async (scenario) => {
          const expected = errorFor(scenario)
          const response = await mapStudioGenerationError(expected.error, null, 'Object edit property test')
          const body = await response.json()
          expect(response.status).toBe(expected.status)
          expect(StudioGenerationErrorZ.safeParse(body).success).toBe(true)
          expect(body).toHaveProperty('error')
          for (const forbidden of ['rawProviderResponse', 'providerModelIdentity', 'canonical', 'selection', 'spatial', 'stack']) {
            expect(body).not.toHaveProperty(forbidden)
          }
        },
      ),
      { numRuns: 100 },
    )
  })
})

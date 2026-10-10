import { STUDIO_MODEL_REQUEST_FAILED_MESSAGE, studioProviderFailureMessage } from '../model-failure-message'
import {
  loadStudioModelEndpoints,
  resolveStudioGenerationModel,
  StudioModelEndpointError,
  studioModelChoice,
} from '../model-endpoints'
import { resolveRequestedStudioModel } from '../generation-request'

const STD_URL = 'https://models.test/v1beta/models/gemini-nano-banana-2.1:generateContent'
const PRO_URL = 'https://models.test/v1beta/models/gemini-3-pro-image:generateContent'

describe('studio model endpoints', () => {
  it('loads two different models from the test environment', () => {
    const endpoints = loadStudioModelEndpoints()
    expect(endpoints.std.modelId).toBe('gemini-3.1-flash-image')
    expect(endpoints.pro.modelId).toBe('gemini-3-pro-image')
    expect(endpoints.std.modelId).not.toBe(endpoints.pro.modelId)
    expect(endpoints.std.url).toBe(
      'https://models.test/v1beta/models/gemini-3.1-flash-image:generateContent',
    )
    expect(endpoints.pro.url).toBe(
      'https://models.test/v1beta/models/gemini-3-pro-image:generateContent',
    )
  })

  it('fails when either URL is missing or both name the same model', () => {
    expect(() => loadStudioModelEndpoints({})).toThrow(/STUDIO_STD_MODEL_URL is required/)
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: STD_URL,
      }),
    ).toThrow(/STUDIO_PRO_MODEL_URL is required/)
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: 'https://models.test/v1beta/models/gemini-a:generateContent',
        STUDIO_PRO_MODEL_URL: 'https://other.test/v1beta/models/gemini-a:generateContent',
      }),
    ).toThrow(/must name different models/)
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: 'https://models.test/v1beta/models/Gemini-A:generateContent',
        STUDIO_PRO_MODEL_URL: 'https://models.test/v1beta/models/gemini-a:generateContent',
      }),
    ).toThrow(StudioModelEndpointError)
  })

  it('rejects urls that are not https generateContent endpoints', () => {
    const std = STD_URL
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: 'http://models.test/v1beta/models/gemini-a:generateContent',
        STUDIO_PRO_MODEL_URL: PRO_URL,
      }),
    ).toThrow(/https/)
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: 'https://user:secret@models.test/v1beta/models/gemini-a:generateContent',
        STUDIO_PRO_MODEL_URL: PRO_URL,
      }),
    ).toThrow(/credentials/)
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: `${std}?key=secret`,
        STUDIO_PRO_MODEL_URL: PRO_URL,
      }),
    ).toThrow(/query string/)
    expect(() =>
      loadStudioModelEndpoints({
        STUDIO_STD_MODEL_URL: 'https://models.test/v1beta/models/gemini-a',
        STUDIO_PRO_MODEL_URL: PRO_URL,
      }),
    ).toThrow(/generateContent/)
  })

  it('maps historical client ids onto the configured models', () => {
    const env = { STUDIO_STD_MODEL_URL: STD_URL, STUDIO_PRO_MODEL_URL: PRO_URL }
    const endpoints = loadStudioModelEndpoints(env)
    expect(studioModelChoice('gemini-3.1-flash-image-preview', endpoints)).toBe('std')
    expect(studioModelChoice('gemini-3-pro-image', endpoints)).toBe('pro')
    expect(studioModelChoice('nb-pro', endpoints)).toBe('pro')
    expect(studioModelChoice('gemini-nano-banana-2.1', endpoints)).toBe('std')
    expect(studioModelChoice(undefined, endpoints)).toBe('std')
    expect(resolveStudioGenerationModel('pro')).toBe('gemini-3-pro-image')
    expect(loadStudioModelEndpoints(env).std.modelId).toBe('gemini-nano-banana-2.1')
    expect(loadStudioModelEndpoints(env).pro.modelId).toBe('gemini-3-pro-image')
  })

  it('fails closed when the process environment does not define both URLs', () => {
    const previousStd = process.env.STUDIO_STD_MODEL_URL
    const previousPro = process.env.STUDIO_PRO_MODEL_URL
    delete process.env.STUDIO_STD_MODEL_URL
    delete process.env.STUDIO_PRO_MODEL_URL
    try {
      expect(() => resolveRequestedStudioModel('pro')).toThrow(StudioModelEndpointError)
    } finally {
      process.env.STUDIO_STD_MODEL_URL = previousStd
      process.env.STUDIO_PRO_MODEL_URL = previousPro
    }
  })
})

describe('studio provider failure message', () => {
  it('tells the user to retry or switch tier when the model or provider fails', () => {
    expect(studioProviderFailureMessage(404, 'models/gemini-x is not found')).toBe(
      STUDIO_MODEL_REQUEST_FAILED_MESSAGE,
    )
    expect(studioProviderFailureMessage(400, 'models/gemini-x is not found')).toBe(
      STUDIO_MODEL_REQUEST_FAILED_MESSAGE,
    )
    expect(studioProviderFailureMessage(503, 'unavailable')).toBe(STUDIO_MODEL_REQUEST_FAILED_MESSAGE)
    expect(studioProviderFailureMessage(400, 'Invalid request parameters')).toBeNull()
    expect(studioProviderFailureMessage(403, 'forbidden')).toBeNull()
    expect(studioProviderFailureMessage(429, 'rate limit')).toBeNull()
    expect(STUDIO_MODEL_REQUEST_FAILED_MESSAGE).toMatch(/switch to Std or Pro/)
  })
})

/**
 * Studio Std/Pro image models are chosen only through environment URLs.
 * Hardcoded model ids stay as historical aliases so older clients and stored
 * rows still map onto whichever models the URLs currently name.
 */

export type StudioModelChoice = 'std' | 'pro'

export interface StudioModelEndpoint {
  url: string
  modelId: string
}

export interface StudioModelEndpoints {
  std: StudioModelEndpoint
  pro: StudioModelEndpoint
}

export class StudioModelEndpointError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudioModelEndpointError'
  }
}

const GENERATE_CONTENT_PATH = /\/models\/([^/:]+):generateContent$/
const HISTORICAL_PRO_MODELS = new Set(['pro', 'nb-pro', 'gemini-3-pro-image'])
const HISTORICAL_STD_MODELS = new Set([
  'std',
  'nb2',
  'gemini-3.1-flash-image',
  'gemini-3.1-flash-image-preview',
])

function readEndpoint(name: string, raw: string | undefined): StudioModelEndpoint {
  const value = raw?.trim() ?? ''
  if (!value) {
    throw new StudioModelEndpointError(`${name} is required.`)
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new StudioModelEndpointError(`${name} must be an absolute https generateContent URL.`)
  }

  if (url.protocol !== 'https:') {
    throw new StudioModelEndpointError(`${name} must be an absolute https generateContent URL.`)
  }
  if (url.username || url.password) {
    throw new StudioModelEndpointError(`${name} must not include credentials.`)
  }
  if (url.search) {
    throw new StudioModelEndpointError(`${name} must not include a query string.`)
  }
  if (url.hash) {
    throw new StudioModelEndpointError(`${name} must not include a fragment.`)
  }

  const match = url.pathname.match(GENERATE_CONTENT_PATH)
  const modelId = match?.[1]
  if (!modelId) {
    throw new StudioModelEndpointError(
      `${name} must be a generateContent URL whose path ends in /models/{model}:generateContent.`,
    )
  }

  return { url: url.toString(), modelId }
}

export function loadStudioModelEndpoints(
  env: Record<string, string | undefined> = process.env,
): StudioModelEndpoints {
  const std = readEndpoint('STUDIO_STD_MODEL_URL', env.STUDIO_STD_MODEL_URL)
  const pro = readEndpoint('STUDIO_PRO_MODEL_URL', env.STUDIO_PRO_MODEL_URL)
  if (std.modelId.toLowerCase() === pro.modelId.toLowerCase()) {
    throw new StudioModelEndpointError(
      'STUDIO_STD_MODEL_URL and STUDIO_PRO_MODEL_URL must name different models.',
    )
  }
  return { std, pro }
}

export function studioModelChoice(
  model: unknown,
  endpoints: StudioModelEndpoints = loadStudioModelEndpoints(),
): StudioModelChoice {
  if (typeof model !== 'string') return 'std'
  const normalized = model.trim().toLowerCase()
  if (!normalized || HISTORICAL_STD_MODELS.has(normalized)) return 'std'
  if (HISTORICAL_PRO_MODELS.has(normalized)) return 'pro'
  if (normalized === endpoints.pro.modelId.toLowerCase()) return 'pro'
  if (normalized === endpoints.std.modelId.toLowerCase()) return 'std'
  return 'std'
}

/** Model id Studio should call for a client Std/Pro selection. */
export function resolveStudioGenerationModel(model: unknown): string {
  const endpoints = loadStudioModelEndpoints()
  return endpoints[studioModelChoice(model, endpoints)].modelId
}

export function studioStdModelId(): string {
  return loadStudioModelEndpoints().std.modelId
}

/**
 * Full generateContent URL when `model` is one of the configured endpoints.
 * Returns null for other callers so they keep their own base URL.
 */
export function configuredStudioModelUrl(model: string): string | null {
  try {
    const endpoints = loadStudioModelEndpoints()
    if (model === endpoints.std.modelId) return endpoints.std.url
    if (model === endpoints.pro.modelId) return endpoints.pro.url
  } catch {
    return null
  }
  return null
}

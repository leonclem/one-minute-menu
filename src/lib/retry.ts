export class HttpError extends Error {
  status: number
  code?: string
  body?: unknown
  constructor(message: string, status: number, body?: unknown, code?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.body = body
    this.code = code
  }
}

export interface RetryOptions {
  retries?: number
  baseDelayMs?: number
  maxDelayMs?: number
  timeoutMs?: number
  // For tests/customization
  delayStrategy?: (attempt: number, baseDelayMs: number, maxDelayMs: number) => number
}

function defaultDelayStrategy(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponential = baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * baseDelayMs
  return Math.min(exponential + jitter, maxDelayMs)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function isTransientHttpStatus(status: number): boolean {
  if (status === 408 || status === 429) return true
  if (status >= 500 && status <= 599) return true
  return false
}

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const {
    retries = 3,
    baseDelayMs = 250,
    maxDelayMs = 2000,
    delayStrategy = defaultDelayStrategy,
  } = options

  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      const isTransient =
        error instanceof HttpError
          ? isTransientHttpStatus(error.status)
          : error instanceof TypeError // e.g., network error
      if (attempt === retries || !isTransient) break
      const delay = delayStrategy(attempt, baseDelayMs, maxDelayMs)
      await sleep(delay)
    }
  }
  throw lastError
}

export interface FetchRetryOptions extends RetryOptions {
  // no extra for now
}

export async function fetchJsonWithRetry<T = any>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: FetchRetryOptions
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 10000
  return withRetry(async () => {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(input, { ...init, signal: controller.signal })
      const contentType = res.headers.get('content-type') || ''
      const isJson = contentType.includes('application/json')
      const body = isJson ? await res.json().catch(() => undefined) : await res.text().catch(() => undefined)
      if (!res.ok) {
        const message = (body && (body as any).error) || res.statusText || 'Request failed'
        throw new HttpError(message, res.status, body, (body as any)?.code)
      }
      return (body as T) ?? (undefined as any)
    } finally {
      clearTimeout(id)
    }
  }, options)
}



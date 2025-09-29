import { fetchJsonWithRetry, withRetry, HttpError } from '@/lib/retry'

describe('withRetry', () => {
  it('retries on transient HttpError and eventually succeeds', async () => {
    let count = 0
    const result = await withRetry(async () => {
      count++
      if (count < 3) throw new HttpError('Service Unavailable', 503)
      return 'ok'
    }, { baseDelayMs: 1, maxDelayMs: 2 })
    expect(result).toBe('ok')
    expect(count).toBe(3)
  })

  it('does not retry on non-transient HttpError', async () => {
    await expect(
      withRetry(async () => {
        throw new HttpError('Bad Request', 400)
      }, { baseDelayMs: 1, maxDelayMs: 2 })
    ).rejects.toBeInstanceOf(HttpError)
  })
})

describe('fetchJsonWithRetry', () => {
  const originalFetch = global.fetch
  let randomSpy: jest.SpyInstance
  beforeEach(() => {
    jest.useFakeTimers()
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0)
  })
  afterEach(() => {
    jest.useRealTimers()
    global.fetch = originalFetch as any
    randomSpy.mockRestore()
  })

  it('retries fetch on 503 and returns JSON', async () => {
    const makeMockResponse = (status: number, jsonBody: any) => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: (key: string) => (key.toLowerCase() === 'content-type' ? 'application/json' : null) },
      json: async () => jsonBody,
      text: async () => JSON.stringify(jsonBody),
    })

    let calls = 0
    global.fetch = jest.fn(async () => {
      calls++
      if (calls < 2) {
        return makeMockResponse(503, { error: 'Service Unavailable' }) as any
      }
      return makeMockResponse(200, { success: true }) as any
    }) as any

    const p = fetchJsonWithRetry<{ success: boolean }>('/test', undefined, { baseDelayMs: 1, maxDelayMs: 2, timeoutMs: 100 })
    // fast-forward timers for backoff sleep
    await jest.advanceTimersByTimeAsync(10)
    const body = await p
    expect(body).toEqual({ success: true })
    expect(calls).toBe(2)
  })
})



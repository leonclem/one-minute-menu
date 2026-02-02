import '@testing-library/jest-dom'
import 'jest-axe/extend-expect'
import { randomUUID, webcrypto } from 'crypto'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill TextEncoder and TextDecoder for jsdom
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

// Polyfill setImmediate for Winston logger in Jest
if (typeof global.setImmediate === 'undefined') {
  global.setImmediate = (callback, ...args) => setTimeout(callback, 0, ...args)
}

// Polyfill Request and Response for Next.js server components
// These are minimal implementations for testing purposes
if (typeof global.Request === 'undefined') {
  global.Request = class Request {
    constructor(input, init) {
      this.url = typeof input === 'string' ? input : input.url
      this.method = init?.method || 'GET'
      this.headers = new Map(Object.entries(init?.headers || {}))
      this._body = init?.body
    }
    
    async json() {
      return JSON.parse(this._body)
    }
  }
}

if (typeof global.Response === 'undefined') {
  global.Response = class Response {
    constructor(body, init) {
      this.body = body
      this.status = init?.status || 200
      this.statusText = init?.statusText || 'OK'
      this.headers = new Map(Object.entries(init?.headers || {}))
    }
    
    async json() {
      return typeof this.body === 'string' ? JSON.parse(this.body) : this.body
    }
    
    // Static json method required by NextResponse
    static json(data, init) {
      return new Response(JSON.stringify(data), {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers || {})
        }
      })
    }
  }
}

if (typeof global.Headers === 'undefined') {
  global.Headers = class Headers extends Map {
    constructor(init) {
      super(Object.entries(init || {}))
    }
  }
}

// Polyfill crypto.randomUUID for Node.js test environment
if (typeof global.crypto === 'undefined') {
  global.crypto = {}
}
if (typeof global.crypto.randomUUID === 'undefined') {
  global.crypto.randomUUID = randomUUID
}

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter() {
    return {
      route: '/',
      pathname: '/',
      query: {},
      asPath: '/',
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    }
  },
}))

// Mock Supabase (guard if module exists)
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
    })),
  },
}))

// Mock window.matchMedia (only in jsdom environment)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  })
}

// ---------------------------------------------------------------------------
// Test-only environment defaults to avoid real network costs
// ---------------------------------------------------------------------------

if (!process.env.OPENAI_API_KEY) {
  process.env.OPENAI_API_KEY = 'test'
}

// Mock OpenAI client globally so no tokens are consumed in tests
jest.mock('openai', () => {
  const mockOutputText = '{"menu":{"categories":[{"name":"Test","items":[]}]} }'
  const responses = {
    parse: jest.fn(async () => ({ output: [{ content: [{ type: 'output_text', text: mockOutputText }] }] })),
    create: jest.fn(async () => ({ output: [{ content: [{ type: 'output_text', text: mockOutputText }] }] })),
  }
  const OpenAI = function () {
    return { responses }
  }
  return { __esModule: true, default: OpenAI, OpenAI }
})

// jsdom does not implement canvas; mock getContext to prevent errors
if (typeof HTMLCanvasElement !== 'undefined') {
  // @ts-ignore
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({ }))
}
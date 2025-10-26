import '@testing-library/jest-dom'
import { randomUUID, webcrypto } from 'crypto'
import { TextEncoder, TextDecoder } from 'util'

// Polyfill TextEncoder and TextDecoder for jsdom
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

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
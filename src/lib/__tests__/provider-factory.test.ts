import { getBackgroundRemovalProvider } from '../background-removal/provider-factory'

// Mock the replicate provider module to avoid loading the Replicate SDK in tests
jest.mock('../background-removal/providers/replicate', () => {
  const mockProvider = {
    name: 'replicate',
    removeBackground: jest.fn(),
    isAvailable: jest.fn().mockResolvedValue(true),
  }
  return {
    getReplicateProvider: jest.fn(() => mockProvider),
    ReplicateBackgroundRemovalProvider: jest.fn(() => mockProvider),
  }
})

// Reset the module-level singleton between tests
beforeEach(() => {
  jest.resetModules()
  delete process.env.BACKGROUND_REMOVAL_PROVIDER
  delete process.env.REPLICATE_API_TOKEN
})

afterEach(() => {
  delete process.env.BACKGROUND_REMOVAL_PROVIDER
  delete process.env.REPLICATE_API_TOKEN
})

describe('getBackgroundRemovalProvider', () => {
  it('should throw when BACKGROUND_REMOVAL_PROVIDER env var is not set', () => {
    expect(() => getBackgroundRemovalProvider()).toThrow(
      'BACKGROUND_REMOVAL_PROVIDER environment variable is not set'
    )
  })

  it('should throw for unknown provider names', () => {
    process.env.BACKGROUND_REMOVAL_PROVIDER = 'unknown-provider'
    // Re-import to get a fresh module with reset singleton
    const { getBackgroundRemovalProvider: freshGet } =
      require('../background-removal/provider-factory') as typeof import('../background-removal/provider-factory')

    expect(() => freshGet()).toThrow('Unknown background removal provider: "unknown-provider"')
  })

  it('should list available providers in error message for unknown providers', () => {
    process.env.BACKGROUND_REMOVAL_PROVIDER = 'some-random-service'
    const { getBackgroundRemovalProvider: freshGet } =
      require('../background-removal/provider-factory') as typeof import('../background-removal/provider-factory')

    expect(() => freshGet()).toThrow('Available providers: replicate')
  })

  it('should return the replicate provider when configured', () => {
    process.env.BACKGROUND_REMOVAL_PROVIDER = 'replicate'
    process.env.REPLICATE_API_TOKEN = 'test-token'
    const { getBackgroundRemovalProvider: freshGet } =
      require('../background-removal/provider-factory') as typeof import('../background-removal/provider-factory')

    const provider = freshGet()
    expect(provider).toBeDefined()
    expect(provider.name).toBe('replicate')
  })

  it('should return the same singleton instance on subsequent calls', () => {
    process.env.BACKGROUND_REMOVAL_PROVIDER = 'replicate'
    process.env.REPLICATE_API_TOKEN = 'test-token'
    const { getBackgroundRemovalProvider: freshGet } =
      require('../background-removal/provider-factory') as typeof import('../background-removal/provider-factory')

    const first = freshGet()
    const second = freshGet()
    expect(first).toBe(second)
  })
})

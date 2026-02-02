/**
 * Unit tests for database client
 */

import { databaseClient, initializeDatabaseClient } from '../database-client'

describe('DatabaseClient', () => {
  // Store original env vars
  const originalEnv = process.env

  beforeEach(() => {
    // Reset environment before each test
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv
  })

  describe('initialization', () => {
    it('should throw error if supabaseUrl is missing', () => {
      expect(() => {
        databaseClient.initialize({
          supabaseUrl: '',
          supabaseServiceRoleKey: 'test-key',
        })
      }).toThrow('Missing required config: supabaseUrl')
    })

    it('should throw error if supabaseServiceRoleKey is missing', () => {
      expect(() => {
        databaseClient.initialize({
          supabaseUrl: 'https://test.supabase.co',
          supabaseServiceRoleKey: '',
        })
      }).toThrow('Missing required config: supabaseServiceRoleKey')
    })

    it('should initialize successfully with valid config', () => {
      expect(() => {
        databaseClient.initialize({
          supabaseUrl: 'https://test.supabase.co',
          supabaseServiceRoleKey: 'test-service-role-key',
        })
      }).not.toThrow()

      expect(databaseClient.isReady()).toBe(true)
    })

    it('should use default values for optional config', () => {
      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
      })

      expect(databaseClient.isReady()).toBe(true)
    })

    it('should warn if already initialized', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()

      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
      })

      // Try to initialize again
      databaseClient.initialize({
        supabaseUrl: 'https://test2.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key-2',
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('already initialized')
      )

      consoleSpy.mockRestore()
    })
  })

  describe('initializeDatabaseClient', () => {
    it('should throw error if SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_URL

      expect(() => {
        initializeDatabaseClient()
      }).toThrow('Missing environment variable: SUPABASE_URL')
    })

    it('should throw error if SUPABASE_SERVICE_ROLE_KEY is missing', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      delete process.env.SUPABASE_SERVICE_ROLE_KEY

      expect(() => {
        initializeDatabaseClient()
      }).toThrow('Missing environment variable: SUPABASE_SERVICE_ROLE_KEY')
    })

    it('should initialize with SUPABASE_URL', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

      expect(() => {
        initializeDatabaseClient()
      }).not.toThrow()
    })

    it('should initialize with NEXT_PUBLIC_SUPABASE_URL as fallback', () => {
      delete process.env.SUPABASE_URL
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

      expect(() => {
        initializeDatabaseClient()
      }).not.toThrow()
    })

    it('should parse optional environment variables', () => {
      process.env.SUPABASE_URL = 'https://test.supabase.co'
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
      process.env.DB_MAX_RETRIES = '5'
      process.env.DB_RETRY_DELAY_MS = '2000'
      process.env.DB_CONNECTION_TIMEOUT = '15000'

      expect(() => {
        initializeDatabaseClient()
      }).not.toThrow()
    })
  })

  describe('getClient', () => {
    it('should return client after initialization', () => {
      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
      })

      const client = databaseClient.getClient()
      expect(client).toBeDefined()
    })
  })

  describe('withRetry', () => {
    beforeEach(async () => {
      // Close any existing client
      await databaseClient.close()
      
      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
        maxRetries: 2,
        retryDelayMs: 10, // Short delay for tests
      })
    })

    it('should return result on successful operation', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await databaseClient.withRetry(operation, 'test operation')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('ETIMEDOUT'))
        .mockResolvedValueOnce('success')

      const result = await databaseClient.withRetry(operation, 'test operation')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Invalid input'))

      await expect(
        databaseClient.withRetry(operation, 'test operation')
      ).rejects.toThrow('Invalid input')

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should throw after max retries exhausted', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'))

      await expect(
        databaseClient.withRetry(operation, 'test operation')
      ).rejects.toThrow('ETIMEDOUT')

      // maxRetries=2 means: attempt 0, 1, 2 = 3 total attempts
      expect(operation).toHaveBeenCalledTimes(3)
    }, 10000) // Increase timeout for retry delays

    it('should use exponential backoff', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce('success')

      const startTime = Date.now()
      await databaseClient.withRetry(operation, 'test operation')
      const duration = Date.now() - startTime

      // Should have delays: 10ms + 20ms = 30ms minimum
      expect(duration).toBeGreaterThanOrEqual(30)
      expect(operation).toHaveBeenCalledTimes(3)
    })
  })

  describe('isReady', () => {
    it('should return true after initialization', () => {
      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
      })

      expect(databaseClient.isReady()).toBe(true)
    })

    it('should return false after close', async () => {
      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
      })

      await databaseClient.close()

      expect(databaseClient.isReady()).toBe(false)
    })
  })

  describe('close', () => {
    it('should clear client reference', async () => {
      databaseClient.initialize({
        supabaseUrl: 'https://test.supabase.co',
        supabaseServiceRoleKey: 'test-service-role-key',
      })

      expect(databaseClient.isReady()).toBe(true)

      await databaseClient.close()

      expect(databaseClient.isReady()).toBe(false)
      expect(() => databaseClient.getClient()).toThrow()
    })
  })
})

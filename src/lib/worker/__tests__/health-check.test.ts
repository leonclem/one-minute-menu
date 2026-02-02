/**
 * Unit tests for health check module
 * 
 * Task 20.1: Implement GET /health endpoint
 */

import {
  checkDatabase,
  checkStorage,
  checkPuppeteer,
  checkMemory,
  performHealthCheck,
  type HealthCheck,
  type HealthStatus
} from '../health-check'
import { databaseClient } from '../database-client'
import { StorageClient } from '../storage-client'

// Mock dependencies
jest.mock('../database-client')

// Mock puppeteer module
const mockBrowser = {
  close: jest.fn().mockResolvedValue(undefined)
}

jest.mock('puppeteer', () => ({
  launch: jest.fn()
}))

describe('Health Check Module', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('checkDatabase', () => {
    it('should return healthy when database is ready and connected', async () => {
      // Mock database client
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(true)
      jest.spyOn(databaseClient, 'testConnection').mockResolvedValue(true)

      const result = await checkDatabase()

      expect(result.healthy).toBe(true)
      expect(result.message).toBe('Database connection OK')
    })

    it('should return unhealthy when database client is not initialized', async () => {
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(false)

      const result = await checkDatabase()

      expect(result.healthy).toBe(false)
      expect(result.message).toBe('Database client not initialized')
    })

    it('should return unhealthy when database connection test fails', async () => {
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(true)
      jest.spyOn(databaseClient, 'testConnection').mockResolvedValue(false)

      const result = await checkDatabase()

      expect(result.healthy).toBe(false)
      expect(result.message).toBe('Database connection test failed')
    })

    it('should return unhealthy when database throws error', async () => {
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(true)
      jest.spyOn(databaseClient, 'testConnection').mockRejectedValue(
        new Error('Connection timeout')
      )

      const result = await checkDatabase()

      expect(result.healthy).toBe(false)
      expect(result.message).toBe('Connection timeout')
    })
  })

  describe('checkStorage', () => {
    it('should return healthy when storage is accessible', async () => {
      const mockStorageClient = {
        list: jest.fn().mockResolvedValue([])
      } as any

      const result = await checkStorage(mockStorageClient)

      expect(result.healthy).toBe(true)
      expect(result.message).toBe('Storage connection OK')
      expect(mockStorageClient.list).toHaveBeenCalledWith('', { limit: 1 })
    })

    it('should return unhealthy when storage throws error', async () => {
      const mockStorageClient = {
        list: jest.fn().mockRejectedValue(new Error('Storage unavailable'))
      } as any

      const result = await checkStorage(mockStorageClient)

      expect(result.healthy).toBe(false)
      expect(result.message).toBe('Storage unavailable')
    })
  })

  describe('checkPuppeteer', () => {
    it('should return healthy when Puppeteer launches successfully', async () => {
      const puppeteer = require('puppeteer')
      const mockBrowserInstance = {
        close: jest.fn().mockResolvedValue(undefined)
      }
      puppeteer.launch.mockResolvedValue(mockBrowserInstance)

      const result = await checkPuppeteer()

      expect(result.healthy).toBe(true)
      expect(result.message).toBe('Puppeteer OK')
      expect(mockBrowserInstance.close).toHaveBeenCalled()
    })

    it('should return unhealthy when Puppeteer fails to launch', async () => {
      const puppeteer = require('puppeteer')
      puppeteer.launch.mockRejectedValue(
        new Error('Failed to launch browser')
      )

      const result = await checkPuppeteer()

      expect(result.healthy).toBe(false)
      expect(result.message).toBe('Failed to launch browser')
    })
  })

  describe('checkMemory', () => {
    it('should return healthy when memory usage is below 80%', () => {
      // Mock process.memoryUsage to return 50% usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024, // 50 MB
        heapTotal: 100 * 1024 * 1024, // 100 MB
        rss: 100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      })

      const result = checkMemory()

      expect(result.healthy).toBe(true)
      expect(result.message).toContain('Memory usage: 50.0%')
    })

    it('should return unhealthy when memory usage exceeds 80%', () => {
      // Mock process.memoryUsage to return 85% usage
      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 85 * 1024 * 1024, // 85 MB
        heapTotal: 100 * 1024 * 1024, // 100 MB
        rss: 100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      })

      const result = checkMemory()

      expect(result.healthy).toBe(false)
      expect(result.message).toContain('High memory usage: 85.0%')
    })

    it('should handle memory check errors gracefully', () => {
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory check failed')
      })

      const result = checkMemory()

      expect(result.healthy).toBe(false)
      expect(result.message).toBe('Memory check failed')
    })
  })

  describe('performHealthCheck', () => {
    it('should return healthy status when all checks pass', async () => {
      // Mock all checks to pass
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(true)
      jest.spyOn(databaseClient, 'testConnection').mockResolvedValue(true)

      const mockStorageClient = {
        list: jest.fn().mockResolvedValue([])
      } as any

      const puppeteer = require('puppeteer')
      const mockBrowserInstance = {
        close: jest.fn().mockResolvedValue(undefined)
      }
      puppeteer.launch.mockResolvedValue(mockBrowserInstance)

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      })

      const result = await performHealthCheck(mockStorageClient)

      expect(result.status).toBe('healthy')
      expect(result.checks.database.healthy).toBe(true)
      expect(result.checks.storage.healthy).toBe(true)
      expect(result.checks.puppeteer.healthy).toBe(true)
      expect(result.checks.memory.healthy).toBe(true)
      expect(result.timestamp).toBeDefined()
    })

    it('should return unhealthy status when any check fails', async () => {
      // Mock database to fail
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(false)

      const mockStorageClient = {
        list: jest.fn().mockResolvedValue([])
      } as any

      const puppeteer = require('puppeteer')
      const mockBrowserInstance = {
        close: jest.fn().mockResolvedValue(undefined)
      }
      puppeteer.launch.mockResolvedValue(mockBrowserInstance)

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 50 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      })

      const result = await performHealthCheck(mockStorageClient)

      expect(result.status).toBe('unhealthy')
      expect(result.checks.database.healthy).toBe(false)
    })

    it('should return unhealthy when multiple checks fail', async () => {
      // Mock database and storage to fail
      jest.spyOn(databaseClient, 'isReady').mockReturnValue(false)

      const mockStorageClient = {
        list: jest.fn().mockRejectedValue(new Error('Storage error'))
      } as any

      const puppeteer = require('puppeteer')
      puppeteer.launch.mockRejectedValue(new Error('Puppeteer error'))

      jest.spyOn(process, 'memoryUsage').mockReturnValue({
        heapUsed: 90 * 1024 * 1024,
        heapTotal: 100 * 1024 * 1024,
        rss: 100 * 1024 * 1024,
        external: 0,
        arrayBuffers: 0
      })

      const result = await performHealthCheck(mockStorageClient)

      expect(result.status).toBe('unhealthy')
      expect(result.checks.database.healthy).toBe(false)
      expect(result.checks.storage.healthy).toBe(false)
      expect(result.checks.puppeteer.healthy).toBe(false)
      expect(result.checks.memory.healthy).toBe(false)
    })
  })
})

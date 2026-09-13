/**
 * Unit tests for health check server
 * 
 * Task 20.1: Implement GET /health endpoint
 */

import http from 'http'
import { AddressInfo } from 'net'
import { HealthServer } from '../health-server'
import { StorageClient } from '../storage-client'
import * as healthCheck from '../health-check'

// Mock dependencies
jest.mock('../health-check')
jest.mock('../database-client')

describe('HealthServer', () => {
  let server: HealthServer
  let mockStorageClient: StorageClient
  // Port 0 lets the OS assign a free ephemeral port so these tests do not
  // collide with a local Next.js (or other) process on 3000/3001.
  const TEST_PORT = 0

  beforeEach(() => {
    mockStorageClient = {
      list: jest.fn().mockResolvedValue([])
    } as any
  })

  afterEach(async () => {
    if (server) {
      await server.stop()
    }
  })

  describe('GET /health', () => {
    it('should return 200 when all health checks pass', async () => {
      const mockHealthStatus = {
        status: 'healthy' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: { healthy: true, message: 'Database connection OK' },
          storage: { healthy: true, message: 'Storage connection OK' },
          puppeteer: { healthy: true, message: 'Puppeteer OK' },
          memory: { healthy: true, message: 'Memory usage: 50.0%' }
        }
      }

      jest.spyOn(healthCheck, 'performHealthCheck').mockResolvedValue(mockHealthStatus)

      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      await server.start()

      const response = await makeRequest('/health', server.getPort())

      expect(response.statusCode).toBe(200)
      expect(response.body.status).toBe('healthy')
      expect(response.body.checks.database.healthy).toBe(true)
      expect(response.body.checks.storage.healthy).toBe(true)
      expect(response.body.checks.puppeteer.healthy).toBe(true)
      expect(response.body.checks.memory.healthy).toBe(true)
    })

    it('should return 503 when health checks fail', async () => {
      const mockHealthStatus = {
        status: 'unhealthy' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: { healthy: false, message: 'Database connection failed' },
          storage: { healthy: true, message: 'Storage connection OK' },
          puppeteer: { healthy: true, message: 'Puppeteer OK' },
          memory: { healthy: true, message: 'Memory usage: 50.0%' }
        }
      }

      jest.spyOn(healthCheck, 'performHealthCheck').mockResolvedValue(mockHealthStatus)

      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      await server.start()

      const response = await makeRequest('/health', server.getPort())

      expect(response.statusCode).toBe(503)
      expect(response.body.status).toBe('unhealthy')
      expect(response.body.checks.database.healthy).toBe(false)
    })

    it('should return 503 when health check throws error', async () => {
      jest.spyOn(healthCheck, 'performHealthCheck').mockRejectedValue(
        new Error('Health check failed')
      )

      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      await server.start()

      const response = await makeRequest('/health', server.getPort())

      expect(response.statusCode).toBe(503)
      expect(response.body.status).toBe('unhealthy')
      expect(response.body.error).toBe('Health check failed')
    })
  })

  describe('GET /', () => {
    it('should return service information', async () => {
      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      await server.start()

      const response = await makeRequest('/', server.getPort())

      expect(response.statusCode).toBe(200)
      expect(response.body.service).toBe('railway-export-worker')
      expect(response.body.status).toBe('running')
      expect(response.body.timestamp).toBeDefined()
    })
  })

  describe('404 handling', () => {
    it('should return 404 for unknown routes', async () => {
      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      await server.start()

      const response = await makeRequest('/unknown', server.getPort())

      expect(response.statusCode).toBe(404)
      expect(response.body.error).toBe('Not Found')
      expect(response.body.path).toBe('/unknown')
    })
  })

  describe('Server lifecycle', () => {
    it('should start and stop cleanly', async () => {
      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      await server.start()
      
      // Verify server is running
      const response = await makeRequest('/', server.getPort())
      expect(response.statusCode).toBe(200)

      const boundPort = server.getPort()
      await server.stop()

      // Verify server is stopped (connection should fail)
      await expect(makeRequest('/', boundPort)).rejects.toThrow()
    })

    it('should handle stop when server is not running', async () => {
      server = new HealthServer({
        port: TEST_PORT,
        storageClient: mockStorageClient
      })

      // Should not throw
      await expect(server.stop()).resolves.not.toThrow()
    })

    it('should reject start when the port is already in use', async () => {
      const holder = await listenOnEphemeralPort()
      const busyPort = (holder.address() as AddressInfo).port

      server = new HealthServer({
        port: busyPort,
        storageClient: mockStorageClient
      })

      await expect(server.start()).rejects.toMatchObject({ code: 'EADDRINUSE' })

      await closeServer(holder)
    })
  })
})

/**
 * Helper function to make HTTP requests to the test server
 */
function makeRequest(path: string, port: number): Promise<{
  statusCode: number
  body: any
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method: 'GET'
      },
      (res) => {
        let data = ''

        res.on('data', (chunk) => {
          data += chunk
        })

        res.on('end', () => {
          try {
            const body = JSON.parse(data)
            resolve({
              statusCode: res.statusCode || 500,
              body
            })
          } catch (error) {
            reject(new Error('Failed to parse response'))
          }
        })
      }
    )

    req.on('error', reject)
    req.end()
  })
}

function listenOnEphemeralPort(): Promise<http.Server> {
  return new Promise((resolve, reject) => {
    const holder = http.createServer()
    holder.once('error', reject)
    holder.listen(0, () => {
      holder.removeListener('error', reject)
      resolve(holder)
    })
  })
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

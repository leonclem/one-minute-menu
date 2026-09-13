/**
 * Health Check Server for Railway Workers
 * 
 * Provides a simple HTTP server for health checks.
 * This runs alongside the worker process to allow Railway to monitor worker health.
 * 
 * Task 20.1: Implement GET /health endpoint
 * Requirements: Monitoring and Observability
 */

import http from 'http'
import { performHealthCheck } from './health-check'
import { StorageClient } from './storage-client'

export interface HealthServerConfig {
  port: number
  storageClient: StorageClient
}

export class HealthServer {
  private server: http.Server | null = null
  private port: number
  private storageClient: StorageClient

  constructor(config: HealthServerConfig) {
    this.port = config.port
    this.storageClient = config.storageClient
  }

  /**
   * Handle incoming HTTP requests
   */
  private async handleRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse
  ): Promise<void> {
    const url = req.url || '/'

    // Health check endpoint
    if (url === '/health' && req.method === 'GET') {
      try {
        const health = await performHealthCheck(this.storageClient)
        const statusCode = health.status === 'healthy' ? 200 : 503
        
        res.writeHead(statusCode, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(health, null, 2))
      } catch (error) {
        console.error('[HealthServer] Error performing health check:', error)
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        }, null, 2))
      }
      return
    }

    // Root endpoint
    if (url === '/' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        service: 'railway-export-worker',
        status: 'running',
        timestamp: new Date().toISOString()
      }, null, 2))
      return
    }

    // 404 for all other routes
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Not Found',
      path: url
    }, null, 2))
  }

  /**
   * Port the server is bound to. After `start()`, this is the actual listening
   * port (useful when constructed with port 0 for an ephemeral assignment).
   */
  getPort(): number {
    return this.port
  }

  /**
   * Start the health check server
   */
  async start(): Promise<void> {
    if (this.server) {
      throw new Error('Health check server is already running')
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          console.error('[HealthServer] Error handling request:', error)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            error: 'Internal Server Error'
          }))
        })
      })

      this.server = server

      const onError = (err: Error) => {
        this.server = null
        reject(err)
      }

      server.once('error', onError)

      server.listen(this.port, () => {
        server.removeListener('error', onError)
        const address = server.address()
        if (address && typeof address === 'object') {
          this.port = address.port
        }
        console.log(`[HealthServer] Health check server listening on port ${this.port}`)
        resolve()
      })
    })
  }

  /**
   * Stop the health check server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve()
        return
      }

      const server = this.server
      this.server = null

      server.close((err) => {
        if (err) {
          const code = (err as NodeJS.ErrnoException).code
          if (code === 'ERR_SERVER_NOT_RUNNING') {
            resolve()
            return
          }
          console.error('[HealthServer] Error stopping health check server:', err)
          reject(err)
        } else {
          console.log('[HealthServer] Health check server stopped')
          resolve()
        }
      })
    })
  }
}

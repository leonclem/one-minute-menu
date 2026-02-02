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
   * Start the health check server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          console.error('[HealthServer] Error handling request:', error)
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            error: 'Internal Server Error'
          }))
        })
      })

      this.server.listen(this.port, () => {
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

      this.server.close((err) => {
        if (err) {
          console.error('[HealthServer] Error stopping health check server:', err)
          reject(err)
        } else {
          console.log('[HealthServer] Health check server stopped')
          this.server = null
          resolve()
        }
      })
    })
  }
}

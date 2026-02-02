/**
 * Health Check Module for Railway Workers
 * 
 * Provides health check functionality to monitor:
 * - Database connectivity
 * - Storage connectivity
 * - Puppeteer availability
 * - Memory usage
 * 
 * Task 20.1: Implement GET /health endpoint
 * Requirements: Monitoring and Observability
 */

import { databaseClient } from './database-client'
import { StorageClient } from './storage-client'
import puppeteer from 'puppeteer'

export interface HealthCheck {
  healthy: boolean
  message: string
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  checks: {
    database: HealthCheck
    storage: HealthCheck
    puppeteer: HealthCheck
    memory: HealthCheck
  }
}

/**
 * Check database connectivity
 * 
 * @returns Health check result for database
 */
export async function checkDatabase(): Promise<HealthCheck> {
  try {
    if (!databaseClient.isReady()) {
      return {
        healthy: false,
        message: 'Database client not initialized'
      }
    }

    const isConnected = await databaseClient.testConnection()
    
    if (!isConnected) {
      return {
        healthy: false,
        message: 'Database connection test failed'
      }
    }

    return {
      healthy: true,
      message: 'Database connection OK'
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

/**
 * Check storage connectivity
 * 
 * @param storageClient - Storage client instance
 * @returns Health check result for storage
 */
export async function checkStorage(storageClient: StorageClient): Promise<HealthCheck> {
  try {
    // Try to list files (limit 1) to verify storage access
    await storageClient.list('', { limit: 1 })
    
    return {
      healthy: true,
      message: 'Storage connection OK'
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown storage error'
    }
  }
}

/**
 * Check Puppeteer availability
 * 
 * @returns Health check result for Puppeteer
 */
export async function checkPuppeteer(): Promise<HealthCheck> {
  try {
    const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH
    
    const browser = await puppeteer.launch({
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true
    })
    
    await browser.close()
    
    return {
      healthy: true,
      message: 'Puppeteer OK'
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown Puppeteer error'
    }
  }
}

/**
 * Check memory usage
 * 
 * @returns Health check result for memory
 */
export function checkMemory(): HealthCheck {
  try {
    const usage = process.memoryUsage()
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100
    
    if (heapUsedPercent > 80) {
      return {
        healthy: false,
        message: `High memory usage: ${heapUsedPercent.toFixed(1)}%`
      }
    }
    
    return {
      healthy: true,
      message: `Memory usage: ${heapUsedPercent.toFixed(1)}%`
    }
  } catch (error) {
    return {
      healthy: false,
      message: error instanceof Error ? error.message : 'Unknown memory error'
    }
  }
}

/**
 * Perform comprehensive health check
 * 
 * @param storageClient - Storage client instance
 * @returns Complete health status
 */
export async function performHealthCheck(storageClient: StorageClient): Promise<HealthStatus> {
  const [database, storage, puppeteerCheck, memory] = await Promise.all([
    checkDatabase(),
    checkStorage(storageClient),
    checkPuppeteer(),
    Promise.resolve(checkMemory())
  ])

  const allHealthy = database.healthy && storage.healthy && puppeteerCheck.healthy && memory.healthy

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks: {
      database,
      storage,
      puppeteer: puppeteerCheck,
      memory
    }
  }
}

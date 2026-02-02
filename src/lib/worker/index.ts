/**
 * Railway Worker Main Entry Point
 * 
 * This is the main entry point for the Railway export worker.
 * It initializes all components and starts the worker process.
 * 
 * Task 23.1: Implement worker/index.ts
 * Requirements: 2.1, 2.2
 * 
 * Responsibilities:
 * - Load configuration from environment variables
 * - Initialize database client
 * - Initialize storage client
 * - Initialize notification service (already exists)
 * - Initialize Puppeteer renderer
 * - Run canary export test
 * - Initialize job poller and processor
 * - Register graceful shutdown handler
 * - Start health check server
 * - Start polling for jobs
 */

import { initializeDatabaseClient } from './database-client'
import { StorageClient } from './storage-client'
import { PuppeteerRenderer } from './puppeteer-renderer'
import { JobProcessor } from './job-processor'
import { JobPoller } from './job-poller'
import { GracefulShutdown } from './graceful-shutdown'
import { HealthServer } from './health-server'
import { logWorkerEvent, logInfo, logError } from './logger'
import { startMetricsServer } from './metrics-server'

/**
 * Worker configuration loaded from environment variables
 */
interface WorkerConfig {
  // Database
  supabaseUrl: string
  supabaseServiceRoleKey: string
  
  // Storage
  storageBucket: string
  
  // Worker settings
  workerId: string
  maxConcurrentRenders: number
  jobTimeoutSeconds: number
  pollingIntervalBusyMs: number
  pollingIntervalIdleMs: number
  gracefulShutdownTimeoutMs: number
  
  // Puppeteer
  puppeteerExecutablePath?: string
  
  // Health check
  healthCheckPort: number
  
  // Metrics
  metricsPort: number
  
  // Feature flags
  enableCanaryExport: boolean
  
  // Supabase Public URL (for translation)
  nextPublicSupabaseUrl?: string
}

/**
 * Load configuration from environment variables
 * 
 * @throws Error if required environment variables are missing
 */
function loadConfig(): WorkerConfig {
  // Required variables
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const storageBucket = process.env.STORAGE_BUCKET

  if (!supabaseUrl) {
    throw new Error('Missing required environment variable: SUPABASE_URL')
  }

  if (!supabaseServiceRoleKey) {
    throw new Error('Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY')
  }

  if (!storageBucket) {
    throw new Error('Missing required environment variable: STORAGE_BUCKET')
  }

  // Optional variables with defaults
  const workerId = process.env.WORKER_ID || `worker-${process.pid}`
  const maxConcurrentRenders = parseInt(process.env.MAX_CONCURRENT_RENDERS || '3', 10)
  const jobTimeoutSeconds = parseInt(process.env.JOB_TIMEOUT_SECONDS || '60', 10)
  const pollingIntervalBusyMs = parseInt(process.env.POLLING_INTERVAL_BUSY_MS || '2000', 10)
  const pollingIntervalIdleMs = parseInt(process.env.POLLING_INTERVAL_IDLE_MS || '5000', 10)
  const gracefulShutdownTimeoutMs = parseInt(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS || '30000', 10)
  const healthCheckPort = parseInt(process.env.HEALTH_CHECK_PORT || '3000', 10)
  const metricsPort = parseInt(process.env.METRICS_PORT || '9090', 10)
  const enableCanaryExport = process.env.ENABLE_CANARY_EXPORT !== 'false' // Default true

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
    storageBucket,
    workerId,
    maxConcurrentRenders,
    jobTimeoutSeconds,
    pollingIntervalBusyMs,
    pollingIntervalIdleMs,
    gracefulShutdownTimeoutMs,
    puppeteerExecutablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
    healthCheckPort,
    metricsPort,
    enableCanaryExport,
    nextPublicSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  }
}

/**
 * Main worker initialization and startup
 */
async function main() {
  console.log('='.repeat(80))
  console.log('Railway Export Worker Starting')
  console.log('='.repeat(80))

  // Log worker startup
  logWorkerEvent.startup()

  try {
    // Step 1: Load configuration from environment variables
    logInfo('Loading configuration')
    const config = loadConfig()
    logInfo('Configuration loaded', {
      worker_id: config.workerId,
      max_concurrent_renders: config.maxConcurrentRenders,
      job_timeout_seconds: config.jobTimeoutSeconds,
      polling_interval_busy_ms: config.pollingIntervalBusyMs,
      polling_interval_idle_ms: config.pollingIntervalIdleMs,
      graceful_shutdown_timeout_ms: config.gracefulShutdownTimeoutMs,
      health_check_port: config.healthCheckPort,
      metrics_port: config.metricsPort,
      enable_canary_export: config.enableCanaryExport,
    })

    // Step 2: Initialize database client
    // Requirement 2.1: Establish database connection
    logInfo('Initializing database client')
    initializeDatabaseClient()
    logInfo('Database client initialized')

    // Step 3: Initialize storage client
    logInfo('Initializing storage client')
    const storageClient = new StorageClient({
      supabase_url: config.supabaseUrl,
      supabase_service_role_key: config.supabaseServiceRoleKey,
      storage_bucket: config.storageBucket,
    })
    logInfo('Storage client initialized')

    // Step 4: Initialize Puppeteer renderer
    logInfo('Initializing Puppeteer renderer')
    const renderer = new PuppeteerRenderer({
      maxConcurrentInstances: config.maxConcurrentRenders,
      executablePath: config.puppeteerExecutablePath,
    })
    await renderer.initialize()
    logInfo('Puppeteer renderer initialized')

    // Step 5: Run canary export test
    // Requirement 2.2: Verify Puppeteer rendering capability before accepting jobs
    if (config.enableCanaryExport) {
      logInfo('Running canary export test')
      try {
        await renderer.runCanaryExport()
        logInfo('Canary export test passed')
      } catch (error) {
        logError('Canary export test failed', error as Error)
        console.error('\nWorker cannot start: Puppeteer rendering is not working')
        console.error('Please check:')
        console.error('  - Chromium is installed')
        console.error('  - PUPPETEER_EXECUTABLE_PATH is set correctly')
        console.error('  - Required system dependencies are installed')
        process.exit(1)
      }
    } else {
      logInfo('Canary export test skipped (disabled)')
    }

    // Step 6: Initialize job processor
    logInfo('Initializing job processor')
    const processor = new JobProcessor({
      renderer,
      storageClient,
      jobTimeoutSeconds: config.jobTimeoutSeconds,
    })
    logInfo('Job processor initialized')

    // Step 7: Initialize job poller (without callbacks first)
    // Requirement 2.1: Begin polling for pending jobs
    logInfo('Initializing job poller')
    const poller = new JobPoller({
      processor,
      workerId: config.workerId,
      pollingIntervalBusyMs: config.pollingIntervalBusyMs,
      pollingIntervalIdleMs: config.pollingIntervalIdleMs,
    })
    logInfo('Job poller initialized')

    // Step 8: Initialize graceful shutdown handler
    logInfo('Initializing graceful shutdown handler')
    const gracefulShutdown = new GracefulShutdown({
      poller,
      processor,
      shutdownTimeoutMs: config.gracefulShutdownTimeoutMs,
    })

    // Connect job tracking callbacks
    ;(poller as any).onJobStart = (jobPromise: Promise<void>) => {
      gracefulShutdown.setCurrentJob(jobPromise)
    }
    ;(poller as any).onJobComplete = () => {
      gracefulShutdown.clearCurrentJob()
    }

    // Register graceful shutdown handler
    gracefulShutdown.register()
    logInfo('Graceful shutdown handler registered')

    // Step 9: Start health check server
    logInfo('Starting health check server')
    const healthServer = new HealthServer({
      port: config.healthCheckPort,
      storageClient,
    })
    await healthServer.start()
    logInfo('Health check server started', { port: config.healthCheckPort })

    // Step 10: Start metrics server
    logInfo('Starting metrics server')
    await startMetricsServer()
    logInfo('Metrics server started', { port: config.metricsPort })

    // Worker is ready
    logWorkerEvent.ready()

    console.log('\n' + '='.repeat(80))
    console.log('Worker Ready - Starting job polling')
    console.log('='.repeat(80))
    console.log(`Worker ID: ${config.workerId}`)
    console.log(`Health check: http://localhost:${config.healthCheckPort}/health`)
    console.log(`Metrics: http://localhost:${config.metricsPort}/metrics`)
    console.log('Press Ctrl+C to stop')
    console.log('='.repeat(80) + '\n')

    await poller.start()

    // Keep process alive
    // The poller will run indefinitely until SIGTERM is received
  } catch (error) {
    logError('Worker failed to start', error as Error)
    console.error('\n' + '='.repeat(80))
    console.error('FATAL ERROR: Worker failed to start')
    console.error('='.repeat(80))
    console.error(error)
    console.error('='.repeat(80))
    process.exit(1)
  }
}

// Start the worker
main().catch((error) => {
  console.error('Unhandled error in main:', error)
  process.exit(1)
})

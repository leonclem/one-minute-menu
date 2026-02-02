/**
 * Prometheus metrics collection for Railway workers
 * 
 * Provides metrics for:
 * - Job counters (created, completed, failed)
 * - Job duration histogram
 * - Queue depth gauge
 * - Active renders gauge
 */

import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const register = new Registry();

// Collect default metrics (CPU, memory, etc.)
collectDefaultMetrics({ register });

/**
 * Job counters
 */
export const jobsCreated = new Counter({
  name: 'export_jobs_created_total',
  help: 'Total number of export jobs created',
  labelNames: ['export_type', 'priority'],
  registers: [register]
});

export const jobsCompleted = new Counter({
  name: 'export_jobs_completed_total',
  help: 'Total number of export jobs completed successfully',
  labelNames: ['export_type'],
  registers: [register]
});

export const jobsFailed = new Counter({
  name: 'export_jobs_failed_total',
  help: 'Total number of export jobs that failed',
  labelNames: ['export_type', 'error_category'],
  registers: [register]
});

export const jobsRetried = new Counter({
  name: 'export_jobs_retried_total',
  help: 'Total number of export jobs retried',
  labelNames: ['export_type', 'retry_count'],
  registers: [register]
});

/**
 * Job duration histogram
 * Buckets: 1s, 5s, 10s, 30s, 60s, 120s
 */
export const jobDuration = new Histogram({
  name: 'export_job_duration_seconds',
  help: 'Export job processing duration in seconds',
  labelNames: ['export_type'],
  buckets: [1, 5, 10, 30, 60, 120],
  registers: [register]
});

/**
 * Render duration histogram
 * Buckets: 1s, 5s, 10s, 20s, 30s, 45s, 60s
 */
export const renderDuration = new Histogram({
  name: 'export_render_duration_seconds',
  help: 'Puppeteer rendering duration in seconds',
  labelNames: ['export_type'],
  buckets: [1, 5, 10, 20, 30, 45, 60],
  registers: [register]
});

/**
 * Storage upload duration histogram
 * Buckets: 0.5s, 1s, 2s, 5s, 10s, 30s
 */
export const uploadDuration = new Histogram({
  name: 'export_upload_duration_seconds',
  help: 'Storage upload duration in seconds',
  labelNames: ['export_type'],
  buckets: [0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

/**
 * Queue depth gauge
 */
export const queueDepth = new Gauge({
  name: 'export_queue_depth',
  help: 'Number of pending export jobs (available for claiming)',
  registers: [register]
});

/**
 * Processing jobs gauge
 */
export const processingJobs = new Gauge({
  name: 'export_processing_jobs',
  help: 'Number of jobs currently being processed',
  labelNames: ['worker_id'],
  registers: [register]
});

/**
 * Active renders gauge
 */
export const activeRenders = new Gauge({
  name: 'export_active_renders',
  help: 'Number of active Puppeteer browser instances',
  labelNames: ['worker_id'],
  registers: [register]
});

/**
 * Stale jobs counter
 */
export const staleJobsRecovered = new Counter({
  name: 'export_stale_jobs_recovered_total',
  help: 'Total number of stale jobs recovered and reset to pending',
  registers: [register]
});

/**
 * File cleanup counter
 */
export const filesDeleted = new Counter({
  name: 'export_files_deleted_total',
  help: 'Total number of old export files deleted from storage',
  registers: [register]
});

/**
 * Circuit breaker state gauge
 */
export const circuitBreakerState = new Gauge({
  name: 'export_circuit_breaker_open',
  help: 'Circuit breaker state (1 = open, 0 = closed)',
  labelNames: ['service'],
  registers: [register]
});

/**
 * Helper functions to record metrics
 */
export const recordJobCreated = (exportType: string, priority: number) => {
  jobsCreated.inc({ export_type: exportType, priority: priority.toString() });
};

export const recordJobCompleted = (exportType: string, durationSeconds: number) => {
  jobsCompleted.inc({ export_type: exportType });
  jobDuration.observe({ export_type: exportType }, durationSeconds);
};

export const recordJobFailed = (exportType: string, errorCategory: string) => {
  jobsFailed.inc({ export_type: exportType, error_category: errorCategory });
};

export const recordJobRetried = (exportType: string, retryCount: number) => {
  jobsRetried.inc({ export_type: exportType, retry_count: retryCount.toString() });
};

export const recordRenderDuration = (exportType: string, durationSeconds: number) => {
  renderDuration.observe({ export_type: exportType }, durationSeconds);
};

export const recordUploadDuration = (exportType: string, durationSeconds: number) => {
  uploadDuration.observe({ export_type: exportType }, durationSeconds);
};

export const updateQueueDepth = (depth: number) => {
  queueDepth.set(depth);
};

export const incrementProcessingJobs = (workerId: string) => {
  processingJobs.inc({ worker_id: workerId });
};

export const decrementProcessingJobs = (workerId: string) => {
  processingJobs.dec({ worker_id: workerId });
};

export const incrementActiveRenders = (workerId: string) => {
  activeRenders.inc({ worker_id: workerId });
};

export const decrementActiveRenders = (workerId: string) => {
  activeRenders.dec({ worker_id: workerId });
};

export const recordStaleJobRecovered = () => {
  staleJobsRecovered.inc();
};

export const recordFileDeleted = () => {
  filesDeleted.inc();
};

export const setCircuitBreakerState = (service: string, isOpen: boolean) => {
  circuitBreakerState.set({ service }, isOpen ? 1 : 0);
};

/**
 * Get metrics in Prometheus format
 */
export const getMetrics = async (): Promise<string> => {
  return register.metrics();
};

/**
 * Reset all metrics (useful for testing)
 */
export const resetMetrics = () => {
  register.resetMetrics();
};

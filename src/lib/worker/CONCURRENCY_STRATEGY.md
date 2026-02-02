# Worker Concurrency Strategy

## Overview

This document defines the concurrency strategy for Railway workers processing export jobs. The strategy balances simplicity, reliability, and resource efficiency while providing a clear path for future optimization.

## Current Strategy: Serial Processing (v1)

### Approach

Workers claim and process **one job at a time** in a serial fashion:

1. Worker polls database for pending jobs
2. Worker claims exactly one job atomically using `SELECT FOR UPDATE SKIP LOCKED`
3. Worker processes the job completely (render → validate → upload → update status)
4. Worker releases the job (transaction commits)
5. Worker repeats from step 1

### Configuration

```typescript
const WORKER_CONFIG = {
  MAX_CONCURRENT_RENDERS: 1,  // Process one job at a time
  POLLING_INTERVAL_BUSY_MS: 2000,  // Poll every 2s when jobs available
  POLLING_INTERVAL_IDLE_MS: 5000,  // Poll every 5s when queue empty
};
```

### Rationale

**Why serial processing initially?**

1. **Simplicity**: Easier to reason about, debug, and monitor
2. **Resource Predictability**: Each worker uses exactly 1 Puppeteer instance at a time
3. **Memory Safety**: Chromium memory spikes are contained to one render at a time
4. **Proven Pattern**: Matches the existing synchronous export implementation
5. **Horizontal Scaling**: Multiple workers provide parallelism at the fleet level

**Resource Usage per Worker:**
- 1 active Puppeteer browser instance
- ~500MB-1GB RAM per render (varies by menu complexity)
- Predictable CPU usage (one render at a time)

### Horizontal Scaling

Parallelism is achieved by running **multiple worker instances**:

```
Worker 1: [Job A] → [Job B] → [Job C] → ...
Worker 2: [Job D] → [Job E] → [Job F] → ...
Worker 3: [Job G] → [Job H] → [Job I] → ...
```

Each worker processes jobs serially, but the fleet processes jobs in parallel. This provides:
- **Fault Isolation**: One worker crash doesn't affect others
- **Simple Deployment**: Scale by adding more Railway instances
- **Load Distribution**: Database-level locking distributes work automatically

### Implementation

```typescript
class JobPoller {
  private isRunning = false;
  private currentJob: ExportJob | null = null;

  async start(): Promise<void> {
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        // Claim one job
        const job = await this.claimJob();
        
        if (job) {
          this.currentJob = job;
          
          // Process job completely before claiming next
          await this.processor.process(job);
          
          this.currentJob = null;
        }
        
        // Adaptive polling interval
        const interval = job 
          ? WORKER_CONFIG.POLLING_INTERVAL_BUSY_MS 
          : WORKER_CONFIG.POLLING_INTERVAL_IDLE_MS;
        
        await this.sleep(interval);
      } catch (error) {
        logger.error('Polling error', { error });
        await this.sleep(5000); // Back off on error
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Wait for current job to complete (graceful shutdown)
    if (this.currentJob) {
      logger.info('Waiting for current job to complete', {
        job_id: this.currentJob.id
      });
    }
  }

  private async claimJob(): Promise<ExportJob | null> {
    // Atomic claim using SELECT FOR UPDATE SKIP LOCKED
    const result = await db.query(`
      BEGIN;
      
      WITH claimed AS (
        SELECT id
        FROM export_jobs
        WHERE status = 'pending'
          AND available_at <= NOW()
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE export_jobs
      SET 
        status = 'processing',
        worker_id = $1,
        started_at = NOW(),
        updated_at = NOW()
      FROM claimed
      WHERE export_jobs.id = claimed.id
      RETURNING export_jobs.*;
      
      COMMIT;
    `, [this.workerId]);
    
    return result.rows[0] || null;
  }
}
```

## Future Strategy: Bounded Parallel Processing (v2)

### Motivation

Once the serial approach is proven stable, we can optimize throughput by processing multiple jobs per worker:

**Benefits:**
- Higher throughput per worker instance
- Better resource utilization (CPU and I/O overlap)
- Reduced polling overhead
- Lower per-job latency under high load

**Risks:**
- Increased memory pressure (multiple Chromium instances)
- More complex error handling and shutdown logic
- Harder to debug concurrent issues
- Potential for resource contention

### Proposed Approach

Workers maintain a **bounded local queue** of claimed jobs:

1. Worker claims up to `MAX_CONCURRENT_RENDERS` jobs at once
2. Worker processes jobs in parallel using a worker pool
3. As jobs complete, worker claims more to maintain queue depth
4. Worker respects resource limits (memory, CPU)

### Configuration

```typescript
const WORKER_CONFIG_V2 = {
  MAX_CONCURRENT_RENDERS: 3,  // Process up to 3 jobs in parallel
  CLAIM_BATCH_SIZE: 3,  // Claim 3 jobs at once
  POLLING_INTERVAL_MS: 2000,  // Poll every 2s
  MEMORY_THRESHOLD_PERCENT: 80,  // Stop claiming if memory > 80%
};
```

### Implementation Sketch

```typescript
class JobPoller {
  private isRunning = false;
  private activeJobs: Set<ExportJob> = new Set();
  private maxConcurrency = WORKER_CONFIG_V2.MAX_CONCURRENT_RENDERS;

  async start(): Promise<void> {
    this.isRunning = true;
    
    while (this.isRunning) {
      try {
        // Check if we can claim more jobs
        const availableSlots = this.maxConcurrency - this.activeJobs.size;
        
        if (availableSlots > 0 && !this.isMemoryConstrained()) {
          // Claim multiple jobs at once
          const jobs = await this.claimJobs(availableSlots);
          
          // Process each job in parallel
          for (const job of jobs) {
            this.activeJobs.add(job);
            
            this.processor.process(job)
              .then(() => {
                this.activeJobs.delete(job);
              })
              .catch((error) => {
                logger.error('Job processing failed', { 
                  job_id: job.id, 
                  error 
                });
                this.activeJobs.delete(job);
              });
          }
        }
        
        await this.sleep(WORKER_CONFIG_V2.POLLING_INTERVAL_MS);
      } catch (error) {
        logger.error('Polling error', { error });
        await this.sleep(5000);
      }
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    
    // Wait for all active jobs to complete
    logger.info('Waiting for active jobs to complete', {
      active_count: this.activeJobs.size
    });
    
    while (this.activeJobs.size > 0) {
      await this.sleep(1000);
    }
  }

  private async claimJobs(count: number): Promise<ExportJob[]> {
    // Claim multiple jobs atomically
    const result = await db.query(`
      BEGIN;
      
      WITH claimed AS (
        SELECT id
        FROM export_jobs
        WHERE status = 'pending'
          AND available_at <= NOW()
        ORDER BY priority DESC, created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE export_jobs
      SET 
        status = 'processing',
        worker_id = $2,
        started_at = NOW(),
        updated_at = NOW()
      FROM claimed
      WHERE export_jobs.id = claimed.id
      RETURNING export_jobs.*;
      
      COMMIT;
    `, [count, this.workerId]);
    
    return result.rows;
  }

  private isMemoryConstrained(): boolean {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    return heapUsedPercent > WORKER_CONFIG_V2.MEMORY_THRESHOLD_PERCENT;
  }
}
```

### Resource Management

**Memory Monitoring:**
```typescript
class ResourceMonitor {
  checkMemory(): { safe: boolean; usage: number } {
    const usage = process.memoryUsage();
    const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
    
    return {
      safe: heapUsedPercent < 80,
      usage: heapUsedPercent
    };
  }

  async waitForMemory(timeoutMs: number = 30000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeoutMs) {
      const { safe } = this.checkMemory();
      if (safe) return;
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    throw new Error('Memory constraint timeout');
  }
}
```

**Puppeteer Pool:**
```typescript
class PuppeteerPool {
  private browsers: Browser[] = [];
  private maxSize = 3;

  async getBrowser(): Promise<Browser> {
    // Reuse existing browser if available
    if (this.browsers.length < this.maxSize) {
      const browser = await puppeteer.launch({
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      this.browsers.push(browser);
      return browser;
    }
    
    // Wait for a browser to become available
    return this.waitForBrowser();
  }

  async releaseBrowser(browser: Browser): Promise<void> {
    // Close browser to free memory
    await browser.close();
    const index = this.browsers.indexOf(browser);
    if (index > -1) {
      this.browsers.splice(index, 1);
    }
  }

  private async waitForBrowser(): Promise<Browser> {
    // Wait for a slot to open up
    while (this.browsers.length >= this.maxSize) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return this.getBrowser();
  }
}
```

### Migration Path

**Phase 1: Validate Serial Processing (Current)**
- Deploy with `MAX_CONCURRENT_RENDERS=1`
- Monitor stability, error rates, completion times
- Establish baseline metrics
- Run for 2-4 weeks in production

**Phase 2: Gradual Concurrency Increase**
- Increase to `MAX_CONCURRENT_RENDERS=2` on 1 worker
- Monitor memory usage, error rates, throughput
- If stable after 1 week, roll out to all workers
- Increase to `MAX_CONCURRENT_RENDERS=3` if metrics remain healthy

**Phase 3: Optimize and Tune**
- Implement memory-aware claiming
- Add circuit breakers for resource exhaustion
- Tune polling intervals based on queue depth
- Consider dynamic concurrency based on job complexity

### Metrics to Monitor

**Before Enabling Parallel Processing:**
- Worker memory usage (p50, p95, p99)
- Job completion time (p50, p95, p99)
- Error rate by category
- Queue depth over time
- Worker CPU utilization

**After Enabling Parallel Processing:**
- Compare all metrics above
- Monitor for memory spikes (OOM crashes)
- Track concurrent render count per worker
- Measure throughput improvement (jobs/minute)
- Watch for increased error rates

### Decision Criteria

**Enable parallel processing if:**
- Serial processing is stable for 2+ weeks
- Memory usage has headroom (< 60% average)
- Error rate is low (< 1%)
- Queue depth indicates demand for higher throughput
- Monitoring and alerting are in place

**Rollback to serial if:**
- OOM crashes increase
- Error rate exceeds 5%
- Job completion time degrades
- Memory usage consistently > 80%
- Debugging becomes difficult

## Summary

**Current (v1): Serial Processing**
- Simple, predictable, reliable
- One job at a time per worker
- Horizontal scaling via multiple workers
- Proven pattern, low risk

**Future (v2): Bounded Parallel Processing**
- Higher throughput per worker
- Up to 3 concurrent renders per worker
- Memory-aware claiming
- Requires careful monitoring and tuning

**Recommendation:** Start with serial processing (v1) and migrate to parallel processing (v2) only after establishing stability and demonstrating need for higher per-worker throughput.

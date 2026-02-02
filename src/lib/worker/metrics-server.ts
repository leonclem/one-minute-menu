/**
 * Metrics server for exposing Prometheus metrics
 * 
 * Runs alongside the worker to expose /metrics endpoint
 */

import http from 'http';
import { getMetrics } from './metrics';
import { logger } from './logger';

const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9090', 10);

/**
 * Create HTTP server for metrics endpoint
 */
export const createMetricsServer = (): http.Server => {
  const server = http.createServer(async (req, res) => {
    // Only handle /metrics endpoint
    if (req.url === '/metrics' && req.method === 'GET') {
      try {
        const metrics = await getMetrics();
        
        res.writeHead(200, {
          'Content-Type': 'text/plain; version=0.0.4; charset=utf-8'
        });
        res.end(metrics);
      } catch (error) {
        logger.error('Error generating metrics', {
          error: error instanceof Error ? error.message : String(error)
        });
        
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Error generating metrics');
      }
    } else {
      // Return 404 for all other routes
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  return server;
};

/**
 * Start metrics server
 */
export const startMetricsServer = (): Promise<http.Server> => {
  return new Promise((resolve, reject) => {
    const server = createMetricsServer();
    
    server.listen(METRICS_PORT, () => {
      logger.info('Metrics server started', {
        port: METRICS_PORT,
        endpoint: `/metrics`
      });
      resolve(server);
    });

    server.on('error', (error) => {
      logger.error('Metrics server error', {
        error: error.message,
        port: METRICS_PORT
      });
      reject(error);
    });
  });
};

/**
 * Stop metrics server
 */
export const stopMetricsServer = (server: http.Server): Promise<void> => {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        logger.error('Error stopping metrics server', {
          error: error.message
        });
        reject(error);
      } else {
        logger.info('Metrics server stopped');
        resolve();
      }
    });
  });
};

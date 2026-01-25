-- Migration 035: Add webhook latency tracking
-- Adds processing_time_ms field to webhook_events for performance monitoring

-- Add processing_time_ms column to webhook_events
ALTER TABLE webhook_events ADD COLUMN IF NOT EXISTS processing_time_ms INTEGER;

-- Add index for latency queries
CREATE INDEX IF NOT EXISTS idx_webhook_events_processing_time 
    ON webhook_events(processing_time_ms) WHERE processing_time_ms IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN webhook_events.processing_time_ms IS 'Time taken to process webhook in milliseconds';

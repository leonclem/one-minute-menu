-- Migration: Add upsert function for extraction metrics
-- This function efficiently updates aggregated metrics for extraction jobs

-- Create function to upsert extraction metrics
CREATE OR REPLACE FUNCTION upsert_extraction_metrics(
  p_prompt_version VARCHAR(50),
  p_schema_version VARCHAR(20),
  p_date DATE,
  p_confidence REAL,
  p_processing_time INTEGER,
  p_token_usage INTEGER,
  p_cost REAL
)
RETURNS VOID AS $
DECLARE
  v_existing_record RECORD;
  v_new_total INTEGER;
  v_new_avg_confidence REAL;
  v_new_avg_processing_time INTEGER;
  v_new_avg_token_usage INTEGER;
  v_new_avg_cost REAL;
BEGIN
  -- Try to get existing record
  SELECT * INTO v_existing_record
  FROM extraction_prompt_metrics
  WHERE prompt_version = p_prompt_version
    AND schema_version = p_schema_version
    AND date = p_date;

  IF FOUND THEN
    -- Calculate new averages
    v_new_total := v_existing_record.total_extractions + 1;
    
    -- Weighted average for confidence
    v_new_avg_confidence := (
      (v_existing_record.average_confidence * v_existing_record.total_extractions) + p_confidence
    ) / v_new_total;
    
    -- Weighted average for processing time
    v_new_avg_processing_time := (
      (v_existing_record.average_processing_time * v_existing_record.total_extractions) + p_processing_time
    ) / v_new_total;
    
    -- Weighted average for token usage
    v_new_avg_token_usage := (
      (v_existing_record.average_token_usage * v_existing_record.total_extractions) + p_token_usage
    ) / v_new_total;
    
    -- Weighted average for cost
    v_new_avg_cost := (
      (v_existing_record.average_cost * v_existing_record.total_extractions) + p_cost
    ) / v_new_total;
    
    -- Update existing record
    UPDATE extraction_prompt_metrics
    SET 
      total_extractions = v_new_total,
      average_confidence = v_new_avg_confidence,
      average_processing_time = v_new_avg_processing_time,
      average_token_usage = v_new_avg_token_usage,
      average_cost = v_new_avg_cost,
      updated_at = NOW()
    WHERE prompt_version = p_prompt_version
      AND schema_version = p_schema_version
      AND date = p_date;
  ELSE
    -- Insert new record
    INSERT INTO extraction_prompt_metrics (
      prompt_version,
      schema_version,
      date,
      total_extractions,
      average_confidence,
      average_processing_time,
      average_token_usage,
      average_cost
    ) VALUES (
      p_prompt_version,
      p_schema_version,
      p_date,
      1,
      p_confidence,
      p_processing_time,
      p_token_usage,
      p_cost
    );
  END IF;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION upsert_extraction_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_extraction_metrics TO service_role;

-- Add comment
COMMENT ON FUNCTION upsert_extraction_metrics IS 'Efficiently upserts extraction metrics with weighted averages';

-- Verification
SELECT 'Metrics upsert function created successfully!' as status;

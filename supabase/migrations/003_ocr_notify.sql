-- Notify triggers for OCR jobs queue
-- Sends payload on channel 'ocr_jobs' when a job is enqueued (status='queued')

CREATE OR REPLACE FUNCTION public.notify_ocr_jobs()
RETURNS trigger AS $$
DECLARE
  payload JSON;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'queued')
     OR (TG_OP = 'UPDATE' AND NEW.status = 'queued' AND (OLD.status IS DISTINCT FROM NEW.status))
  THEN
    payload := json_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'status', NEW.status,
      'created_at', NEW.created_at
    );
    PERFORM pg_notify('ocr_jobs', payload::text);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ocr_jobs_notify_insert ON public.ocr_jobs;
CREATE TRIGGER ocr_jobs_notify_insert
AFTER INSERT ON public.ocr_jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_ocr_jobs();

DROP TRIGGER IF EXISTS ocr_jobs_notify_update ON public.ocr_jobs;
CREATE TRIGGER ocr_jobs_notify_update
AFTER UPDATE OF status ON public.ocr_jobs
FOR EACH ROW EXECUTE FUNCTION public.notify_ocr_jobs();



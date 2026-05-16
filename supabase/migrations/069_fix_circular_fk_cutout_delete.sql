-- ============================================================================
-- Migration 069: Fix circular FK deadlock between ai_generated_images and
--                cutout_generation_logs during user deletion cascade.
--
-- Problem:
--   ai_generated_images.cutout_generation_log_id → cutout_generation_logs(id)
--                                                   ON DELETE SET NULL
--   cutout_generation_logs.image_id              → ai_generated_images(id)
--                                                   ON DELETE SET NULL
--
--   When auth.users is deleted, the cascade reaches ai_generated_images and
--   tries to DELETE those rows. Postgres must first SET NULL on
--   cutout_generation_logs.image_id (the back-reference), but doing so
--   triggers a FK re-check on ai_generated_images.cutout_generation_log_id
--   which is mid-delete — causing "insert or update on table
--   cutout_generation_logs violates foreign key constraint
--   cutout_generation_logs_image_id_fkey".
--
-- Fix:
--   Add a BEFORE DELETE trigger on ai_generated_images that explicitly nulls
--   out the back-reference (cutout_generation_log_id) before the row is
--   deleted. This breaks the cycle so Postgres can complete the cascade
--   without a FK conflict.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.break_cutout_circular_fk_before_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Null out the back-reference so the cutout_generation_logs SET NULL
    -- action doesn't trigger a FK re-check against a row being deleted.
    IF OLD.cutout_generation_log_id IS NOT NULL THEN
        UPDATE public.cutout_generation_logs
        SET image_id = NULL
        WHERE id = OLD.cutout_generation_log_id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.break_cutout_circular_fk_before_delete() IS
    'Breaks the circular FK between ai_generated_images and cutout_generation_logs '
    'before deletion so the cascade from auth.users can complete cleanly.';

CREATE TRIGGER break_cutout_fk_before_ai_image_delete
    BEFORE DELETE ON public.ai_generated_images
    FOR EACH ROW
    EXECUTE FUNCTION public.break_cutout_circular_fk_before_delete();

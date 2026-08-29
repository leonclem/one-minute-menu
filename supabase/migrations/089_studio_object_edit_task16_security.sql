-- Task 16 security hardening. This migration is additive and does not reset,
-- truncate, delete, or recreate any data.
--
-- Evidence and release-control RPCs are called by the server's service-role
-- client only. Client roles must not be able to invoke SECURITY DEFINER RPCs
-- directly with a forged actor/reviewer identifier. The application still
-- performs the profile-role check before reaching these functions.
REVOKE EXECUTE ON FUNCTION public.studio_update_object_edit_operation_control(
    TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_update_object_edit_operation_control(
    TEXT, UUID, TEXT, TIMESTAMPTZ, UUID, TEXT, UUID, TEXT, BOOLEAN, BOOLEAN
) TO service_role;

REVOKE EXECUTE ON FUNCTION public.studio_create_object_edit_spike_evidence_set(
    UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID[]
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.studio_create_object_edit_spike_evidence_set(
    UUID, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ, UUID[]
) TO service_role;

-- Evidence and control tables intentionally remain service-role-only through
-- their existing RLS configuration. Keep this assertion visible to migration
-- reviewers and future diagnostics.
ALTER TABLE public.studio_object_edit_spike_evidence_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_object_edit_spike_evidence_set_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_object_edit_spike_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_object_edit_operation_controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_object_edit_operation_control_audit_events ENABLE ROW LEVEL SECURITY;

import { ANALYTICS_EVENTS } from '@/lib/posthog/events'

export type StudioEventName = Extract<
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS],
  `studio_${string}`
>

export const STUDIO_ALLOWED_PROPERTY_KEYS = [
  'access_reason',
  'access_mode',
  'is_admin',
  'outcome',
  'failure_class',
  'model_class',
  'credit_cost',
  'credit_balance_after',
  'validation_status',
  'duration_ms',
  'stage',
  'surface',
  'has_source_image',
  'variant_count',
  'gallery_size',
  'rating',
  'reason_tag_count',
  'has_comment',
  'is_update',
  'blocked_by',
  'file_size_bucket',
  'mime_class',
  'variant_type',
  'generation_method',
  'export_ready_count',
] as const

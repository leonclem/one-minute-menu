import { z } from 'zod'
import { MAX_FINISHING_TOUCH_LEVEL } from './catalogue'

export const FinishingTouchesMetadataZ = z.object({
  stackIds: z.array(z.string().min(1)).max(MAX_FINISHING_TOUCH_LEVEL),
  level: z.number().int().min(1).max(MAX_FINISHING_TOUCH_LEVEL),
  auto: z.literal(true),
})

export type FinishingTouchesMetadata = z.infer<typeof FinishingTouchesMetadataZ>

export function parseFinishingTouchesMetadata(
  raw: unknown,
): FinishingTouchesMetadata | undefined {
  const parsed = FinishingTouchesMetadataZ.safeParse(raw)
  return parsed.success ? parsed.data : undefined
}

export function finishingTouchesCountBucket(level: number): string {
  return String(level)
}

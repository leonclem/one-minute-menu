import { z } from 'zod'
import { DEFAULT_FINISHING_TOUCH_AMOUNT, type FinishingTouchAmount } from './amount'
import { MAX_FINISHING_TOUCH_LEVEL } from './catalogue'

export const FinishingTouchesMetadataZ = z.object({
  stackIds: z.array(z.string().min(1)).max(MAX_FINISHING_TOUCH_LEVEL),
  level: z.number().int().min(1).max(MAX_FINISHING_TOUCH_LEVEL),
  auto: z.literal(true),
  amount: z.enum(['small', 'medium', 'high']).optional(),
})

export type FinishingTouchesMetadata = {
  stackIds: string[]
  level: number
  auto: true
  amount: FinishingTouchAmount
}

export function parseFinishingTouchesMetadata(
  raw: unknown,
): FinishingTouchesMetadata | undefined {
  const parsed = FinishingTouchesMetadataZ.safeParse(raw)
  if (!parsed.success) return undefined
  const { stackIds, level, auto, amount } = parsed.data
  return {
    stackIds,
    level,
    auto,
    amount: amount ?? DEFAULT_FINISHING_TOUCH_AMOUNT,
  }
}

export function finishingTouchesCountBucket(level: number): string {
  return String(level)
}

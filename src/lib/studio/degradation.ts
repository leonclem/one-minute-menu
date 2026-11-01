import { generativeDepth } from '@/lib/studio/lineage'
import type { StudioImageRecord } from '@/lib/studio/types'

/** First generative hop that shows the note (the child would be GEN 3). */
export const DEGRADATION_WARN_FROM_GEN = 3

export type DegradationTone = 'muted' | 'warm' | 'gold'

export interface DegradationWarningCopy {
  nextGen: number
  /** One line. Firmer wording as the stack deepens; the layout stays the same. */
  line: string
  cta: string
  tone: DegradationTone
}

function editedLead(edits: number): string {
  if (edits === 2) return 'Edited twice'
  return `Edited ${edits} times`
}

/**
 * Copy for a generate that would become this GEN. Null below GEN 3.
 * Tone and wording step up at 4 and 5+. Does not cap — callers still run
 * Generate / Remove / Re-shoot / Expand.
 */
export function degradationWarningCopy(nextGen: number): DegradationWarningCopy | null {
  if (nextGen < DEGRADATION_WARN_FROM_GEN) return null
  const lead = editedLead(nextGen - 1)
  if (nextGen === 3) {
    return {
      nextGen,
      line: `${lead}. Another edit can soften fine detail.`,
      cta: 'Use an earlier photo',
      tone: 'muted',
    }
  }
  if (nextGen === 4) {
    return {
      nextGen,
      line: `${lead}. Another edit often looks softer.`,
      cta: 'Use an earlier photo',
      tone: 'warm',
    }
  }
  return {
    nextGen,
    line: `${lead}. Another edit is likely to look softer.`,
    cta: 'Use an earlier photo',
    tone: 'gold',
  }
}

export function degradationWarningForShot(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): DegradationWarningCopy | null {
  return degradationWarningCopy(generativeDepth(image, images) + 1)
}

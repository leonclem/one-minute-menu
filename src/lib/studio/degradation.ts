import { generativeDepth } from '@/lib/studio/lineage'
import type { StudioImageRecord } from '@/lib/studio/types'

/** First generative hop that shows the gold callout (the child would be GEN 3). */
export const DEGRADATION_WARN_FROM_GEN = 3

/** One-line reason on the compact workbench banner. Full body stays on tool panels. */
export const DEGRADATION_COMPACT_HINT = 'Successive generations can degrade quality.'

export interface DegradationWarningCopy {
  nextGen: number
  title: string
  body: string
  cta: string
}

/**
 * Copy for a generate that would become this GEN. Null below GEN 3.
 * Stronger at 4 and 5+. Does not cap — callers still run Generate / Remove / Re-shoot.
 */
export function degradationWarningCopy(nextGen: number): DegradationWarningCopy | null {
  if (nextGen < DEGRADATION_WARN_FROM_GEN) return null
  if (nextGen === 3) {
    return {
      nextGen,
      title: 'This next shot will be GEN 3',
      body: 'Each AI re-render can soften detail. Branch from an earlier shot if you want a cleaner starting point.',
      cta: 'View shot tree',
    }
  }
  if (nextGen === 4) {
    return {
      nextGen,
      title: 'This next shot will be GEN 4',
      body: 'Quality often drops after several re-renders. Open the shot tree and branch from an earlier photo instead of stacking another generate.',
      cta: 'View shot tree',
    }
  }
  return {
    nextGen,
    title: `This next shot will be GEN ${nextGen}`,
    body: 'Further re-renders are likely to look worse. Branch from an earlier shot in the tree rather than stacking on this one. You can still generate.',
    cta: 'View shot tree',
  }
}

export function degradationWarningForShot(
  image: StudioImageRecord,
  images: readonly StudioImageRecord[],
): DegradationWarningCopy | null {
  return degradationWarningCopy(generativeDepth(image, images) + 1)
}

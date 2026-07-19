/**
 * Resolve lighting/background style keys from target vs original schema into
 * server-side directive clauses (Chunk 4).
 */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  buildStyleDirectiveClause,
  resolveBackgroundStyle,
  resolveLightingStyle,
} from '@/lib/studio/reference-libraries'

export const FOH_STYLE_EXCLUDE_PATHS = [
  'scene_setup.lighting',
  'canvas.background_style',
] as const

export async function resolveStyleDirectiveClauses(
  originalState: MinimalSchema,
  targetState: MinimalSchema,
): Promise<{ clauses: string[]; error?: string }> {
  const clauses: string[] = []

  const fromLighting = originalState.scene_setup?.lighting ?? ''
  const toLighting = targetState.scene_setup?.lighting ?? ''
  if (toLighting && toLighting !== fromLighting) {
    const style = await resolveLightingStyle(toLighting)
    if (!style) {
      return {
        clauses: [],
        error: `Unknown or inactive lighting style: ${toLighting}`,
      }
    }
    clauses.push(
      buildStyleDirectiveClause(style.prompt_fragment, style.negative_constraints),
    )
  }

  const fromBackground = originalState.canvas?.background_style ?? ''
  const toBackground = targetState.canvas?.background_style ?? ''
  if (toBackground && toBackground !== fromBackground) {
    const style = await resolveBackgroundStyle(toBackground)
    if (!style) {
      return {
        clauses: [],
        error: `Unknown or inactive background style: ${toBackground}`,
      }
    }
    clauses.push(
      buildStyleDirectiveClause(style.prompt_fragment, style.negative_constraints),
    )
  }

  return { clauses }
}

/** Prepend resolved style clauses to a client-built directive. */
export function mergeDirectiveWithStyleClauses(
  clientDirective: string,
  styleClauses: string[],
): string {
  const parts = [...styleClauses.map((c) => c.trim()).filter(Boolean), clientDirective.trim()]
  return parts.filter(Boolean).join(' ')
}

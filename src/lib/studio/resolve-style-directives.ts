/** Resolve active style rows for the customer descriptor or admin callers. */

import type { MinimalSchema } from '@/lib/photo-control/minimal-schema'
import {
  resolveBackgroundStyle,
  resolveLightingStyle,
} from '@/lib/studio/reference-libraries'

import type {
  StudioBackgroundStyleRecord,
  StudioLightingStyleRecord,
} from '@/lib/studio/types'

export async function resolveStyleDirectiveClauses(
  originalState: MinimalSchema,
  targetState: MinimalSchema,
): Promise<{
  error?: string
  lightingStyle?: StudioLightingStyleRecord | null
  backgroundStyle?: StudioBackgroundStyleRecord | null
  surfaceStyle?: StudioBackgroundStyleRecord | null
}> {
  let lightingStyle: StudioLightingStyleRecord | null = null
  let backgroundStyle: StudioBackgroundStyleRecord | null = null
  let surfaceStyle: StudioBackgroundStyleRecord | null = null

  const fromLighting = originalState.scene_setup?.lighting ?? ''
  const toLighting = targetState.scene_setup?.lighting ?? ''
  if (toLighting && toLighting !== fromLighting) {
    const style = await resolveLightingStyle(toLighting)
    if (!style) {
      return {
        error: `Unknown or inactive lighting style: ${toLighting}`,
      }
    }
    lightingStyle = style
  }

  const fromBackground = originalState.canvas?.background_style ?? ''
  const toBackground = targetState.canvas?.background_style ?? ''
  if (toBackground && toBackground !== fromBackground) {
    const style = await resolveBackgroundStyle(toBackground)
    if (!style) {
      return {
        error: `Unknown or inactive background style: ${toBackground}`,
      }
    }
    backgroundStyle = style
  }

  const fromSurface = originalState.canvas?.surface_style ?? ''
  const toSurface = targetState.canvas?.surface_style ?? ''
  if (toSurface && toSurface !== fromSurface) {
    const style = await resolveBackgroundStyle(toSurface)
    if (!style) {
      return {
        error: `Unknown or inactive surface style: ${toSurface}`,
      }
    }
    surfaceStyle = style
  }

  return { lightingStyle, backgroundStyle, surfaceStyle }
}

/** Prepend resolved style clauses to a client-built directive (admin sandbox only). */
export function mergeDirectiveWithStyleClauses(
  clientDirective: string,
  styleClauses: string[],
): string {
  const parts = [...styleClauses.map((c) => c.trim()).filter(Boolean), clientDirective.trim()]
  return parts.filter(Boolean).join(' ')
}

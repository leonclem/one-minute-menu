import type { SceneDescriptor } from '@/lib/photo-control/scene-descriptor'
import { harmonizeTabletopLanguage } from '@/lib/studio/tabletop-language'
import { STUDIO_PROPS, propsFromIds, type StudioProp } from './catalogue'
import { PROPS_RULE } from './directive'

/** One more than the catalogue, so a short duplicate list still reaches the id check. */
const STUDIO_PROP_REQUEST_LIMIT = STUDIO_PROPS.length + 1

export interface ParsedStudioProps {
  ok: true
  props: StudioProp[]
}

export interface RejectedStudioProps {
  ok: false
  error: string
}

/**
 * Accept a missing field, or a list of known catalogue ids.
 * Duplicates collapse. Unknown ids are rejected so a typo cannot reach the model.
 */
export function parseStudioPropIds(raw: unknown): ParsedStudioProps | RejectedStudioProps {
  if (raw == null) return { ok: true, props: [] }
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string')) {
    return { ok: false, error: 'props must be an array of prop ids.' }
  }
  if (raw.length > STUDIO_PROP_REQUEST_LIMIT) {
    return { ok: false, error: 'Too many props.' }
  }
  const props = propsFromIds(raw)
  if (props.length !== new Set(raw).size) {
    return { ok: false, error: 'Unknown prop selection.' }
  }
  return { ok: true, props }
}

/** Put the staged props on the descriptor target the edit wrapper is allowed to change. */
export function applyPropsTarget(
  descriptor: SceneDescriptor,
  props: readonly StudioProp[],
  options?: { surfaceChanging?: boolean },
): SceneDescriptor {
  if (props.length === 0) return descriptor
  const surfaceChanging = options?.surfaceChanging ?? false
  return {
    ...descriptor,
    target: {
      ...descriptor.target,
      props: props.map((prop) => ({
        name: prop.label,
        description: prop.description,
        placement: harmonizeTabletopLanguage(prop.placement, surfaceChanging),
      })),
      propsRule: PROPS_RULE,
    },
  }
}

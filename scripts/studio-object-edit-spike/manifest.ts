import { z } from 'zod'
import {
  MovePlacementZ,
  SelectionZ,
  type MovePlacement,
  type Selection,
} from '@/lib/studio/object-edit/contracts'
import {
  SpikeArtifactZ,
  SpikeModelClassZ,
  type SpikeModelClass,
} from '@/lib/studio/object-edit/spike/evidence-store'
import { resolveRequestedStudioModel } from '@/lib/studio/generation-request'
import { STUDIO_FLASH_MODEL, STUDIO_PRO_MODEL } from '@/lib/studio/model-config'

export const SPIKE_MANIFEST_VERSION = 1 as const
export const SPIKE_SCENARIO_TAGS = [
  'isolated_foreground',
  'small',
  'side',
  'background',
  'overlapping',
  'ambiguous',
] as const

export const SpikeScenarioTagZ = z.enum(SPIKE_SCENARIO_TAGS)
export type SpikeScenarioTag = z.infer<typeof SpikeScenarioTagZ>

export const SpikeScenarioCaseZ = z
  .object({
    id: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{2,99}$/),
    operation: z.enum(['remove', 'move']),
    requestedModelClass: SpikeModelClassZ,
    configuredModelIdentifier: z.string().trim().min(1).max(200),
    sourceArtifact: SpikeArtifactZ,
    annotatedArtifact: SpikeArtifactZ.optional(),
    selection: SelectionZ,
    placement: MovePlacementZ.optional(),
    scenarioTags: z.array(SpikeScenarioTagZ).min(1).max(SPIKE_SCENARIO_TAGS.length),
  })
  .strict()
  .superRefine((value, context) => {
    if (new Set(value.scenarioTags).size !== value.scenarioTags.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scenarioTags'],
        message: 'Scenario tags must be unique for each case.',
      })
    }
    if ((value.operation === 'move') !== Boolean(value.placement)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placement'],
        message: 'Move cases require placement and Remove cases must not contain placement.',
      })
    }

    const expectedModel = value.requestedModelClass === 'nb_pro' ? STUDIO_PRO_MODEL : STUDIO_FLASH_MODEL
    if (resolveRequestedStudioModel(value.configuredModelIdentifier) !== expectedModel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['configuredModelIdentifier'],
        message: 'Configured model identifier does not match the requested model class.',
      })
    }
  })

export type SpikeScenarioCase = z.infer<typeof SpikeScenarioCaseZ>

export const StudioObjectEditSpikeManifestZ = z
  .object({
    version: z.literal(SPIKE_MANIFEST_VERSION),
    label: z.string().trim().min(1).max(200),
    cases: z.array(SpikeScenarioCaseZ).min(20).max(500),
  })
  .strict()
  .superRefine((manifest, context) => {
    const ids = new Set<string>()
    for (let index = 0; index < manifest.cases.length; index += 1) {
      const scenarioCase = manifest.cases[index]
      if (ids.has(scenarioCase.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['cases', index, 'id'],
          message: 'Spike case IDs must be unique.',
        })
      }
      ids.add(scenarioCase.id)
    }

    const requiredNb2Groups = [
      { operation: 'remove' as const, requestedModelClass: 'nb2' as const },
      { operation: 'move' as const, requestedModelClass: 'nb2' as const },
    ]
    for (const { operation, requestedModelClass } of requiredNb2Groups) {
      const group = manifest.cases.filter(
        (scenarioCase) =>
          scenarioCase.operation === operation && scenarioCase.requestedModelClass === requestedModelClass,
      )
      const path = ['cases']
      if (group.length < 10) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `${operation}/${requestedModelClass} requires at least 10 representative cases.`,
        })
      }
      const covered = new Set(group.flatMap((scenarioCase) => scenarioCase.scenarioTags))
      for (const tag of SPIKE_SCENARIO_TAGS) {
        if (!covered.has(tag)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path,
            message: `${operation}/${requestedModelClass} is missing required scenario tag ${tag}.`,
          })
        }
      }
    }
  })

export type StudioObjectEditSpikeManifest = z.infer<typeof StudioObjectEditSpikeManifestZ>

export function parseStudioObjectEditSpikeManifest(value: unknown): StudioObjectEditSpikeManifest {
  return StudioObjectEditSpikeManifestZ.parse(value)
}

export interface StableScenarioInputs {
  sourceArtifact: z.infer<typeof SpikeArtifactZ>
  selection: Selection
  placement?: MovePlacement
  operation: 'remove' | 'move'
  requestedModelClass: SpikeModelClass
  configuredModelIdentifier: string
}

/** Returns the comparison inputs that must remain identical across A/B/C. */
export function stableScenarioInputs(scenarioCase: SpikeScenarioCase): StableScenarioInputs {
  return {
    sourceArtifact: scenarioCase.sourceArtifact,
    selection: scenarioCase.selection,
    ...(scenarioCase.placement === undefined ? {} : { placement: scenarioCase.placement }),
    operation: scenarioCase.operation,
    requestedModelClass: scenarioCase.requestedModelClass,
    configuredModelIdentifier: scenarioCase.configuredModelIdentifier,
  }
}

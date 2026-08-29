import {
  finaliseStudioGeneration,
  guardStudioGeneration,
  mapStudioGenerationError,
  resolveRequestedStudioModel,
} from './generation-request'

export {
  finaliseStudioGeneration,
  guardStudioGeneration,
  mapStudioGenerationError,
  resolveRequestedStudioModel,
}
export type {
  FinaliseStudioGenerationInput,
  FinaliseStudioGenerationResult,
  StudioGenerationGuardContext,
  StudioGenerationGuardResult,
} from './generation-request'

import type { PhotoControlMimeType } from '@/lib/photo-control/request-validation'

/**
 * The normalized provider result shared by future Studio generation routes.
 * Provider details remain server-only; routes must map only their established
 * Studio response envelope to the browser.
 */
export interface NormalizedGeneratedImage {
  imageBase64: string
  /** Detected from the returned bytes; null when the output container is unsupported. */
  mimeType: PhotoControlMimeType | null
  /** Provider's inlineData MIME claim, retained for server-side diagnostics only. */
  providerMimeType: string | null
  thoughtSignature?: string
  providerModelIdentity: string | null
}

export interface ExecuteStudioGenerationInput<TProviderInput, TMetadata, TResult> {
  userId: string
  dishId: string
  requestedModel: string
  creditCost: number
  providerInput: TProviderInput
  invokeProvider(input: TProviderInput): Promise<NormalizedGeneratedImage>
  buildMetadata(result: NormalizedGeneratedImage): Promise<TMetadata> | TMetadata
  finalize(input: {
    userId: string
    dishId: string
    requestedModel: string
    creditCost: number
    providerResult: NormalizedGeneratedImage
    metadata: TMetadata
  }): Promise<TResult>
}

/**
 * Executes the provider/metadata/finalizer portion of a Studio generation.
 * Guarding and error mapping are re-exported above so new routes can share the
 * established Studio lifecycle without changing legacy routes during the
 * compatibility refactor.
 */
export async function executeStudioGeneration<TProviderInput, TMetadata, TResult>(
  input: ExecuteStudioGenerationInput<TProviderInput, TMetadata, TResult>,
): Promise<TResult> {
  const providerResult = await input.invokeProvider(input.providerInput)
  const metadata = await input.buildMetadata(providerResult)

  return input.finalize({
    userId: input.userId,
    dishId: input.dishId,
    requestedModel: input.requestedModel,
    creditCost: input.creditCost,
    providerResult,
    metadata,
  })
}

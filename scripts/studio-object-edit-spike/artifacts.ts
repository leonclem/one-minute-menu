import 'server-only'

import { createHash, randomUUID } from 'crypto'
import { z } from 'zod'
import { createAdminSupabaseClient } from '@/lib/supabase-server'
import {
  assertStudioStoragePathOwnedByUser,
  buildStudioStoragePath,
  STUDIO_STORAGE_BUCKET,
} from '@/lib/studio/storage-paths'
import { SpikeArtifactZ } from '@/lib/studio/object-edit/spike/evidence-store'

const ArtifactMimeTypeZ = z.enum(['image/png', 'image/jpeg', 'image/webp'])
const InternalOwnerUserIdZ = z.string().uuid()

export const SpikeArtifactUploadInputZ = z
  .object({
    mimeType: ArtifactMimeTypeZ,
    bytes: z.instanceof(Buffer).refine((value) => value.length > 0, 'Artifact bytes are required.'),
    label: z.string().trim().regex(/^[a-z0-9][a-z0-9_-]{0,79}$/),
  })
  .strict()

export type SpikeArtifactUploadInput = z.infer<typeof SpikeArtifactUploadInputZ>

export function sha256Hex(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** Reads the dedicated internal-only namespace; it is never caller controlled. */
export function configuredSpikeArtifactOwnerUserId(): string {
  const parsed = InternalOwnerUserIdZ.safeParse(process.env.STUDIO_OBJECT_EDIT_SPIKE_ARTIFACT_OWNER_USER_ID)
  if (!parsed.success) {
    throw new Error('STUDIO_OBJECT_EDIT_SPIKE_ARTIFACT_OWNER_USER_ID must be a configured internal UUID.')
  }
  return parsed.data
}

/**
 * Stores an internal spike artifact in the existing Studio bucket. It uses a
 * configured internal owner namespace, never exposes a public URL, and never
 * overwrites an existing object.
 */
export async function uploadSpikeArtifact(
  input: SpikeArtifactUploadInput,
): Promise<z.infer<typeof SpikeArtifactZ>> {
  const value = SpikeArtifactUploadInputZ.parse(input)
  const storageOwnerUserId = configuredSpikeArtifactOwnerUserId()
  const objectId = `spike-${value.label}-${randomUUID()}`
  const storagePath = buildStudioStoragePath(storageOwnerUserId, objectId, value.mimeType)
  assertStudioStoragePathOwnedByUser(storagePath, storageOwnerUserId)

  const supabase = createAdminSupabaseClient()
  const { error } = await supabase.storage.from(STUDIO_STORAGE_BUCKET).upload(storagePath, value.bytes, {
    contentType: value.mimeType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    throw new Error(`Failed to upload internal spike artifact: ${error.message}`)
  }

  return SpikeArtifactZ.parse({
    storagePath,
    mimeType: value.mimeType,
    sha256: sha256Hex(value.bytes),
  })
}

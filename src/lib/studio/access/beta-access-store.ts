import { createAdminSupabaseClient } from '@/lib/supabase-server'

export const STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH = 280

export type StudioBetaAccessRecord = {
  user_id: string
  enabled: boolean
  granted_by: string | null
  note: string | null
  granted_at: string | null
  revoked_at: string | null
  created_at: string
  updated_at: string
}

/** Pure: the row patch a grant produces. */
export function buildGrantPatch(input: {
  adminUserId: string
  note: string | null
  now: string
}): Partial<StudioBetaAccessRecord> {
  return {
    enabled: true,
    granted_by: input.adminUserId,
    note: input.note,
    granted_at: input.now,
    revoked_at: null,
    updated_at: input.now,
  }
}

/** Pure: the row patch a revoke produces. granted_by/granted_at are untouched. */
export function buildRevokePatch(input: {
  note: string | null
  now: string
}): Partial<StudioBetaAccessRecord> {
  return {
    enabled: false,
    note: input.note,
    revoked_at: input.now,
    updated_at: input.now,
  }
}

/** Pure: absent row or enabled !== true means no entitlement. */
export function hasGrant(row: StudioBetaAccessRecord | null | undefined): boolean {
  return row?.enabled === true
}

function normalizeNote(note: string | null | undefined): string | null {
  if (note == null) return null

  const normalized = note.trim()
  if (normalized.length > STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH) {
    throw new Error(
      `Studio beta access note must be ${STUDIO_BETA_ACCESS_NOTE_MAX_LENGTH} characters or fewer`,
    )
  }

  return normalized || null
}

function getErrorMessage(error: { message?: string } | null | undefined): string {
  return error?.message ?? 'unknown error'
}

async function writeAccessRecord(
  userId: string,
  patch: Partial<StudioBetaAccessRecord>,
): Promise<StudioBetaAccessRecord> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_beta_access')
    .upsert(
      { user_id: userId, ...patch },
      { onConflict: 'user_id' },
    )
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`Failed to write studio beta access: ${getErrorMessage(error)}`)
  }

  return data as StudioBetaAccessRecord
}

export async function getStudioBetaAccess(
  userId: string,
): Promise<StudioBetaAccessRecord | null> {
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('studio_beta_access')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to load studio beta access: ${getErrorMessage(error)}`)
  }

  return (data as StudioBetaAccessRecord | null) ?? null
}

export async function hasStudioBetaAccess(userId: string): Promise<boolean> {
  return hasGrant(await getStudioBetaAccess(userId))
}

export async function grantStudioBetaAccess(input: {
  userId: string
  adminUserId: string
  note?: string | null
}): Promise<StudioBetaAccessRecord> {
  const now = new Date().toISOString()
  return writeAccessRecord(
    input.userId,
    buildGrantPatch({
      adminUserId: input.adminUserId,
      note: normalizeNote(input.note),
      now,
    }),
  )
}

export async function revokeStudioBetaAccess(input: {
  userId: string
  adminUserId: string
  note?: string | null
}): Promise<StudioBetaAccessRecord> {
  // The database row retains granted_by and granted_at. adminUserId remains in
  // the public input for symmetry with grants and route-level audit context.
  void input.adminUserId

  const now = new Date().toISOString()
  return writeAccessRecord(
    input.userId,
    buildRevokePatch({
      note: normalizeNote(input.note),
      now,
    }),
  )
}

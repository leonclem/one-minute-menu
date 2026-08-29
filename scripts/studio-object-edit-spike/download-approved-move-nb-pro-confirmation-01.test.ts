/** @jest-environment node */

import { createHash } from 'crypto'
import { mkdir, readFile, writeFile } from 'fs/promises'
import { join } from 'path'

import { createAdminSupabaseClient } from '@/lib/supabase-server'
import { STUDIO_STORAGE_BUCKET } from '@/lib/studio/storage-paths'

const resultDirectory = join(
  process.cwd(),
  '.kiro/specs/studio-object-selection-remove-move/test-images/results',
)
const resultPath = join(resultDirectory, 'move-nb-pro-confirmation-01.json')

type BatchRecord = {
  caseId: string
  variant: 'A' | 'B' | 'C'
  operation: string
  requestedModelClass: string
  configuredModelIdentifier: string
  outcome: string
  outputArtifact?: { storagePath: string; mimeType: string; sha256: string }
}

const downloadApprovedBatch = process.env.DOWNLOAD_APPROVED_NB_PRO_MOVE_CONFIRMATION_01 === 'true' ? it : it.skip

downloadApprovedBatch('downloads and verifies all returned Move/NB Pro confirmation artifacts for internal review only', async () => {
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as { records: BatchRecord[] }
  expect(result.records).toHaveLength(6)
  expect(result.records.every((record) => record.operation === 'move')).toBe(true)
  expect(result.records.every((record) => record.requestedModelClass === 'nb_pro')).toBe(true)
  expect(result.records.every((record) => record.configuredModelIdentifier === 'gemini-3-pro-image')).toBe(true)
  expect(result.records.every((record) => record.outcome === 'generated')).toBe(true)

  const supabase = createAdminSupabaseClient()
  await mkdir(resultDirectory, { recursive: true })
  for (const record of result.records) {
    expect(record.outputArtifact).toBeDefined()
    const artifact = record.outputArtifact!
    const { data, error } = await supabase.storage.from(STUDIO_STORAGE_BUCKET).download(artifact.storagePath)
    if (error || !data) throw new Error(`Unable to download internal spike artifact: ${error?.message ?? 'missing data'}`)
    const bytes = Buffer.from(await data.arrayBuffer())
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256)
    await writeFile(join(resultDirectory, `${record.caseId}-nb-pro-${record.variant}.png`), bytes)
  }
}, 120_000)

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
const resultPath = join(resultDirectory, 'remove-nb-pro-hainanese-01.json')

type BatchRecord = {
  caseId: string
  variant: 'A' | 'B' | 'C'
  outcome: 'generated' | 'provider_error' | 'transport_error' | 'validation_error'
  noFailureArtifactReturned?: true
  outputArtifact?: { storagePath: string; mimeType: string; sha256: string }
}

const downloadApprovedBatch = process.env.DOWNLOAD_APPROVED_NB_PRO_REMOVE_HAINANESE_01 === 'true' ? it : it.skip

downloadApprovedBatch('downloads and verifies generated NB Pro enquiry artifacts while retaining explicit failure absence', async () => {
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as { records: BatchRecord[] }
  expect(result.records).toHaveLength(3)
  expect(result.records.map((record) => record.variant)).toEqual(['A', 'B', 'C'])
  expect(result.records[0]).toMatchObject({ outcome: 'provider_error', noFailureArtifactReturned: true })
  expect(result.records.slice(1).every((record) => record.outcome === 'generated')).toBe(true)

  const supabase = createAdminSupabaseClient()
  await mkdir(resultDirectory, { recursive: true })
  for (const record of result.records) {
    if (record.outcome !== 'generated') continue
    expect(record.outputArtifact).toBeDefined()
    const artifact = record.outputArtifact!
    const { data, error } = await supabase.storage.from(STUDIO_STORAGE_BUCKET).download(artifact.storagePath)
    if (error || !data) throw new Error(`Unable to download internal spike artifact: ${error?.message ?? 'missing data'}`)
    const bytes = Buffer.from(await data.arrayBuffer())
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256)
    await writeFile(join(resultDirectory, `${record.caseId}-nb-pro-${record.variant}.png`), bytes)
  }
}, 120_000)

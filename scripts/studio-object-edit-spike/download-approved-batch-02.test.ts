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
const resultPath = join(resultDirectory, 'remove-nb2-batch-02.json')

type BatchRecord = {
  caseId: string
  variant: 'A' | 'B' | 'C'
  outcome: string
  outputArtifact?: { storagePath: string; mimeType: string; sha256: string }
}

const downloadApprovedBatch = process.env.DOWNLOAD_APPROVED_NB2_REMOVE_BATCH_02 === 'true' ? it : it.skip

downloadApprovedBatch('downloads and verifies generated batch 02 artifacts for internal review only', async () => {
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as { records: BatchRecord[] }
  expect(result.records).toHaveLength(9)
  const supabase = createAdminSupabaseClient()

  await mkdir(resultDirectory, { recursive: true })
  for (const record of result.records) {
    expect(record.outcome).toBe('generated')
    expect(record.outputArtifact).toBeDefined()
    const artifact = record.outputArtifact!
    const { data, error } = await supabase.storage.from(STUDIO_STORAGE_BUCKET).download(artifact.storagePath)
    if (error || !data) throw new Error(`Unable to download internal spike artifact: ${error?.message ?? 'missing data'}`)
    const bytes = Buffer.from(await data.arrayBuffer())
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256)
    await writeFile(join(resultDirectory, `${record.caseId}-${record.variant}.png`), bytes)
  }
}, 120_000)

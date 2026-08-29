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
const resultPath = join(resultDirectory, 'cheeseburger-red-pepper-addition-nb2-01.json')
const outputPath = join(resultDirectory, 'cheeseburger-red-pepper-addition-nb2-01.png')

const downloadApprovedExperiment = process.env.DOWNLOAD_APPROVED_NB2_RED_PEPPER_ADDITION_01 === 'true' ? it : it.skip

downloadApprovedExperiment('downloads and verifies the returned NB2 red-pepper composition artifact', async () => {
  const record = JSON.parse(await readFile(resultPath, 'utf8')) as {
    experiment: string
    model: string
    destination: { x: number; y: number }
    outcome: string
    outputArtifact?: { storagePath: string; mimeType: string; sha256: string }
  }
  expect(record.experiment).toBe('red-pepper-addition-01')
  expect(record.model).toBe('gemini-3.1-flash-image')
  expect(record.destination).toEqual({ x: 0.92, y: 0.57 })
  expect(record.outcome).toBe('generated')
  expect(record.outputArtifact).toBeDefined()

  const artifact = record.outputArtifact!
  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase.storage.from(STUDIO_STORAGE_BUCKET).download(artifact.storagePath)
  if (error || !data) throw new Error(`Unable to download internal experiment artifact: ${error?.message ?? 'missing data'}`)
  const bytes = Buffer.from(await data.arrayBuffer())
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256)

  await mkdir(resultDirectory, { recursive: true })
  await writeFile(outputPath, bytes)
}, 120_000)

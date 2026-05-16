/**
 * sync-placeholder-images.js
 *
 * Copies placeholder item images from one Supabase Storage instance to another.
 * Designed for syncing locally-generated images to Production, but works for
 * any source → destination pair (e.g. prod → staging).
 *
 * Usage:
 *   node scripts/sync-placeholder-images.js
 *
 * Environment variables (can be set in .env.local or passed inline):
 *   SOURCE_SUPABASE_URL          - URL of the source Supabase project (default: local)
 *   SOURCE_SUPABASE_SERVICE_KEY  - Service role key for the source project
 *   DEST_SUPABASE_URL            - URL of the destination Supabase project
 *   DEST_SUPABASE_SERVICE_KEY    - Service role key for the destination project
 *
 * Options (set as env vars or edit the CONFIG block below):
 *   DRY_RUN=true                 - List what would be copied without actually copying
 *   SKIP_EXISTING=true           - Skip files that already exist in destination (default: true)
 *   IMAGE_KEY_FILTER=chinese_    - Only sync keys that start with this prefix (optional)
 *
 * Example — sync local → prod with dry run first:
 *   DRY_RUN=true DEST_SUPABASE_URL=https://xxx.supabase.co DEST_SUPABASE_SERVICE_KEY=xxx node scripts/sync-placeholder-images.js
 *   DEST_SUPABASE_URL=https://xxx.supabase.co DEST_SUPABASE_SERVICE_KEY=xxx node scripts/sync-placeholder-images.js
 */

// Load .env.local for defaults, but don't override vars already set in the environment
require('dotenv').config({ path: '.env.local', override: false })

const { createClient } = require('@supabase/supabase-js')

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BUCKET = 'menu-images'
const PREFIX = 'placeholder-items'
// Files expected inside each image key folder
const EXPECTED_FILES = ['photo.webp', 'cutout.webp']

// For the source, prefer explicit SOURCE_* vars, then fall back to the standard
// .env.local keys (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY), then
// the hardcoded local-only defaults.
const SOURCE_URL =
  process.env.SOURCE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'http://localhost:54321'
const SOURCE_KEY =
  process.env.SOURCE_SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  // Fallback: well-known local dev service role key (only works on localhost)
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const DEST_URL = process.env.DEST_SUPABASE_URL
const DEST_KEY = process.env.DEST_SUPABASE_SERVICE_KEY

const DRY_RUN = process.env.DRY_RUN === 'true'
const SKIP_EXISTING = process.env.SKIP_EXISTING !== 'false' // default true
const KEY_FILTER = process.env.IMAGE_KEY_FILTER || null

// ─── VALIDATION ───────────────────────────────────────────────────────────────

if (!DEST_URL || !DEST_KEY) {
  console.error(`
❌  Missing destination credentials.

Set these environment variables before running:
  DEST_SUPABASE_URL=https://your-project.supabase.co
  DEST_SUPABASE_SERVICE_KEY=your-service-role-key

You can find both in your Supabase dashboard under Project Settings → API.
`)
  process.exit(1)
}

if (SOURCE_URL === DEST_URL) {
  console.error('❌  Source and destination URLs are the same. Aborting to avoid overwriting data.')
  process.exit(1)
}

// ─── CLIENTS ─────────────────────────────────────────────────────────────────

const source = createClient(SOURCE_URL, SOURCE_KEY)
const dest = createClient(DEST_URL, DEST_KEY)

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/** List all image key folders under placeholder-items/ in a given client. */
async function listImageKeys(client, label) {
  const { data, error } = await client.storage.from(BUCKET).list(PREFIX, { limit: 1000 })
  if (error) {
    console.error(`❌  Failed to list ${label} storage:`, error.message)
    process.exit(1)
  }
  return (data || []).map(f => f.name)
}

/** List files inside a specific image key folder. */
async function listFilesInKey(client, imageKey) {
  const { data, error } = await client.storage
    .from(BUCKET)
    .list(`${PREFIX}/${imageKey}`, { limit: 20 })
  if (error) return []
  return (data || []).map(f => f.name)
}

/** Download a file from source storage as a Buffer. */
async function downloadFile(imageKey, fileName) {
  const path = `${PREFIX}/${imageKey}/${fileName}`
  const { data, error } = await source.storage.from(BUCKET).download(path)
  if (error) throw new Error(`Download failed for ${path}: ${error.message}`)
  // data is a Blob in Node — convert to Buffer
  const arrayBuffer = await data.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

/** Upload a Buffer to destination storage. */
async function uploadFile(imageKey, fileName, buffer) {
  const path = `${PREFIX}/${imageKey}/${fileName}`
  const { error } = await dest.storage.from(BUCKET).upload(path, buffer, {
    contentType: 'image/webp',
    upsert: true,
  })
  if (error) throw new Error(`Upload failed for ${path}: ${error.message}`)
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n📦  Placeholder Image Sync')
  console.log('─'.repeat(50))
  console.log(`  Source : ${SOURCE_URL}`)
  console.log(`  Dest   : ${DEST_URL}`)
  console.log(`  Bucket : ${BUCKET}/${PREFIX}`)
  if (DRY_RUN)     console.log('  Mode   : DRY RUN (no files will be written)')
  if (KEY_FILTER)  console.log(`  Filter : keys matching "${KEY_FILTER}*"`)
  if (SKIP_EXISTING) console.log('  Existing files in destination will be skipped')
  console.log('─'.repeat(50))

  // 1. Discover what's in source
  console.log('\n🔍  Scanning source storage...')
  const sourceKeys = await listImageKeys(source, 'source')
  console.log(`    Found ${sourceKeys.length} image key folder(s) in source`)

  // 2. Discover what's already in destination
  console.log('🔍  Scanning destination storage...')
  const destKeys = await listImageKeys(dest, 'destination')
  const destKeySet = new Set(destKeys)
  console.log(`    Found ${destKeys.length} image key folder(s) in destination`)

  // 3. Apply optional filter
  let keysToProcess = sourceKeys
  if (KEY_FILTER) {
    keysToProcess = sourceKeys.filter(k => k.startsWith(KEY_FILTER))
    console.log(`\n    Filter applied — ${keysToProcess.length} key(s) match "${KEY_FILTER}*"`)
  }

  if (keysToProcess.length === 0) {
    console.log('\n⚠️   No image keys to process. Exiting.')
    return
  }

  // 4. For each key, determine which files need copying
  console.log('\n📋  Planning sync...\n')

  const plan = [] // { imageKey, fileName, reason }

  for (const imageKey of keysToProcess) {
    const sourceFiles = await listFilesInKey(source, imageKey)
    const destFiles = SKIP_EXISTING ? await listFilesInKey(dest, imageKey) : []
    const destFileSet = new Set(destFiles)

    for (const fileName of EXPECTED_FILES) {
      if (!sourceFiles.includes(fileName)) continue // not generated yet in source

      if (SKIP_EXISTING && destFileSet.has(fileName)) {
        // Already exists — skip
        continue
      }

      const reason = destFileSet.has(fileName) ? 'overwrite' : 'new'
      plan.push({ imageKey, fileName, reason })
    }
  }

  if (plan.length === 0) {
    console.log('✅  Nothing to sync — destination is already up to date.')
    return
  }

  // Group plan by key for readable output
  const byKey = {}
  for (const entry of plan) {
    if (!byKey[entry.imageKey]) byKey[entry.imageKey] = []
    byKey[entry.imageKey].push(entry)
  }

  const newCount = plan.filter(e => e.reason === 'new').length
  const overwriteCount = plan.filter(e => e.reason === 'overwrite').length
  console.log(`  ${plan.length} file(s) to copy  (${newCount} new, ${overwriteCount} overwrite)`)
  console.log()

  for (const [key, entries] of Object.entries(byKey)) {
    const tags = entries.map(e => `${e.fileName} [${e.reason}]`).join(', ')
    console.log(`  • ${key}: ${tags}`)
  }

  if (DRY_RUN) {
    console.log('\n🏁  Dry run complete — no files were written.')
    return
  }

  // 5. Execute the copy
  console.log('\n🚀  Copying files...\n')

  let copied = 0
  let failed = 0
  const errors = []

  for (const { imageKey, fileName } of plan) {
    const label = `${imageKey}/${fileName}`
    try {
      process.stdout.write(`  ↑ ${label} ... `)
      const buffer = await downloadFile(imageKey, fileName)
      await uploadFile(imageKey, fileName, buffer)
      process.stdout.write('✅\n')
      copied++
    } catch (err) {
      process.stdout.write(`❌\n`)
      errors.push({ label, message: err.message })
      failed++
    }
  }

  // 6. Summary
  console.log('\n─'.repeat(50))
  console.log(`✅  Copied : ${copied}`)
  if (failed > 0) {
    console.log(`❌  Failed : ${failed}`)
    console.log('\nFailed files:')
    for (const e of errors) {
      console.log(`  • ${e.label}: ${e.message}`)
    }
  }
  console.log('─'.repeat(50))
  console.log('\n🏁  Sync complete.\n')
}

main().catch(err => {
  console.error('\n❌  Unexpected error:', err.message)
  process.exit(1)
})

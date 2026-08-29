#!/usr/bin/env node

/**
 * Repair legacy Studio image rows whose declared MIME type, object path, or
 * storage content type does not describe the bytes they contain.
 *
 * Why this exists:
 * Older provider results were uploaded verbatim under a hard-coded image/png
 * declaration. If Gemini returned JPEG or WebP bytes, the child row was stored
 * as .png/image/png. That later broke a second object-edit pass, which correctly
 * compares the source bytes against their declared MIME type.
 *
 * Safety model:
 * - Dry run is the default; it reads storage and reports proposed changes only.
 * - `--apply` copies bytes to a corrected path, rewrites content type, and then
 *   updates the DB row. It deliberately RETAINS the old object as a recoverable
 *   orphan; no storage objects or database rows are deleted by this script.
 * - A target-path collision is only reused when its bytes hash exactly matches
 *   the source. Otherwise the row is skipped and reported as a conflict.
 *
 * Usage:
 *   node scripts/repair-studio-image-mime-metadata.js
 *   node scripts/repair-studio-image-mime-metadata.js --image-id <uuid>
 *   node scripts/repair-studio-image-mime-metadata.js --apply
 *   node scripts/repair-studio-image-mime-metadata.js --apply --limit 25
 *
 * Required environment variables (loaded from .env.local when present):
 *   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY
 */

require('dotenv').config({ path: '.env.local', override: false })

const { createHash } = require('crypto')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const BUCKET = 'ai-generated-images'
const PAGE_SIZE = 100
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff])

function usage(message) {
  if (message) console.error(`\nError: ${message}\n`)
  console.log('Usage: node scripts/repair-studio-image-mime-metadata.js [--apply] [--image-id <uuid>] [--limit <n>]')
  process.exit(message ? 1 : 0)
}

function parseArgs(argv) {
  const options = { apply: false, imageId: null, limit: Number.POSITIVE_INFINITY }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--apply') {
      options.apply = true
    } else if (arg === '--image-id') {
      options.imageId = argv[index + 1]
      index += 1
    } else if (arg === '--limit') {
      const parsed = Number.parseInt(argv[index + 1], 10)
      if (!Number.isInteger(parsed) || parsed <= 0) usage('--limit must be a positive integer.')
      options.limit = parsed
      index += 1
    } else if (arg === '--help' || arg === '-h') {
      usage()
    } else {
      usage(`Unknown option: ${arg}`)
    }
  }
  return options
}

function detectMimeType(buffer) {
  if (buffer.length >= PNG_SIGNATURE.length && buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return 'image/png'
  }
  if (buffer.length >= JPEG_SIGNATURE.length && buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

function extensionForMime(mimeType) {
  if (mimeType === 'image/jpeg') return 'jpg'
  if (mimeType === 'image/webp') return 'webp'
  return 'png'
}

function correctedStoragePath(storagePath, mimeType) {
  const extension = `.${extensionForMime(mimeType)}`
  const currentExtension = path.posix.extname(storagePath)
  return currentExtension ? `${storagePath.slice(0, -currentExtension.length)}${extension}` : `${storagePath}${extension}`
}

function digest(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function publicUrlFor(storage, storagePath) {
  return storage.getPublicUrl(storagePath).data.publicUrl
}

async function download(storage, storagePath) {
  const { data, error } = await storage.download(storagePath)
  if (error || !data) throw new Error(error?.message ?? `No storage object at ${storagePath}`)
  return Buffer.from(await data.arrayBuffer())
}

async function copyOrRefresh(storage, sourceBuffer, sourcePath, targetPath, mimeType) {
  if (sourcePath === targetPath) {
    const { error } = await storage.update(targetPath, sourceBuffer, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: true,
    })
    if (error) throw new Error(`Failed to refresh storage metadata: ${error.message}`)
    return { reusedExistingTarget: false, refreshedInPlace: true }
  }

  const { error: uploadError } = await storage.upload(targetPath, sourceBuffer, {
    contentType: mimeType,
    cacheControl: '31536000',
    upsert: false,
  })
  if (!uploadError) return { reusedExistingTarget: false, refreshedInPlace: false }

  // Do not overwrite an existing corrected object. It is safe to reuse only if
  // it is byte-for-byte identical to the legacy source.
  let existing
  try {
    existing = await download(storage, targetPath)
  } catch {
    throw new Error(`Failed to copy to ${targetPath}: ${uploadError.message}`)
  }
  if (digest(existing) !== digest(sourceBuffer)) {
    throw new Error(`Target collision at ${targetPath}; its bytes differ from ${sourcePath}.`)
  }
  return { reusedExistingTarget: true, refreshedInPlace: false }
}

async function repairRow({ supabase, storage, row, apply }) {
  const sourceBuffer = await download(storage, row.storage_path)
  const detectedMimeType = detectMimeType(sourceBuffer)
  if (!detectedMimeType) {
    return { status: 'skipped', reason: 'unsupported-container', row }
  }

  const targetPath = correctedStoragePath(row.storage_path, detectedMimeType)
  const mimeMatches = row.mime_type === detectedMimeType
  const pathMatches = row.storage_path === targetPath
  if (mimeMatches && pathMatches) {
    return { status: 'unchanged', row, detectedMimeType }
  }

  const targetPublicUrl = publicUrlFor(storage, targetPath)
  if (!apply) {
    return {
      status: 'would-repair',
      row,
      detectedMimeType,
      targetPath,
      targetPublicUrl,
    }
  }

  const copyResult = await copyOrRefresh(
    storage,
    sourceBuffer,
    row.storage_path,
    targetPath,
    detectedMimeType,
  )
  const { data, error } = await supabase
    .from('studio_images')
    .update({
      mime_type: detectedMimeType,
      storage_path: targetPath,
      public_url: targetPublicUrl,
    })
    .eq('id', row.id)
    .eq('storage_path', row.storage_path)
    .eq('mime_type', row.mime_type)
    .select('id')
    .maybeSingle()

  if (error || !data) {
    throw new Error(error?.message ?? 'Row changed concurrently; no repair was committed.')
  }
  return {
    status: 'repaired',
    row,
    detectedMimeType,
    targetPath,
    ...copyResult,
  }
}

async function listRows(supabase, options) {
  if (options.imageId) {
    const { data, error } = await supabase
      .from('studio_images')
      .select('id,user_id,storage_path,public_url,mime_type')
      .eq('id', options.imageId)
      .maybeSingle()
    if (error) throw new Error(`Failed to fetch image ${options.imageId}: ${error.message}`)
    return data ? [data] : []
  }

  const rows = []
  let lastId = null
  while (rows.length < options.limit) {
    let query = supabase
      .from('studio_images')
      .select('id,user_id,storage_path,public_url,mime_type')
      .order('id', { ascending: true })
      .limit(Math.min(PAGE_SIZE, options.limit - rows.length))
    if (lastId) query = query.gt('id', lastId)

    const { data, error } = await query
    if (error) throw new Error(`Failed to list studio images: ${error.message}`)
    if (!data?.length) break
    rows.push(...data)
    lastId = data[data.length - 1].id
    if (data.length < PAGE_SIZE) break
  }
  return rows
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    usage('NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY are required.')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const storage = supabase.storage.from(BUCKET)
  const rows = await listRows(supabase, options)
  const summary = { scanned: rows.length, unchanged: 0, skipped: 0, wouldRepair: 0, repaired: 0, failed: 0 }

  console.log(`Studio MIME repair (${options.apply ? 'APPLY' : 'DRY RUN'}) — ${rows.length} candidate row(s)`)
  for (const row of rows) {
    try {
      const result = await repairRow({ supabase, storage, row, apply: options.apply })
      if (result.status === 'unchanged') {
        summary.unchanged += 1
      } else if (result.status === 'skipped') {
        summary.skipped += 1
        console.warn(`SKIP ${row.id}: ${result.reason} (${row.storage_path})`)
      } else if (result.status === 'would-repair') {
        summary.wouldRepair += 1
        console.log(`WOULD REPAIR ${row.id}: ${row.mime_type}/${row.storage_path} -> ${result.detectedMimeType}/${result.targetPath}`)
      } else {
        summary.repaired += 1
        console.log(`REPAIRED ${row.id}: ${row.mime_type}/${row.storage_path} -> ${result.detectedMimeType}/${result.targetPath}${result.reusedExistingTarget ? ' (reused matching copy)' : ''}`)
      }
    } catch (error) {
      summary.failed += 1
      console.error(`FAILED ${row.id} (${row.storage_path}): ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  console.log('Summary:', summary)
  if (!options.apply && summary.wouldRepair > 0) {
    console.log('No changes were made. Re-run with --apply after reviewing the proposed repairs.')
  }
  if (summary.failed > 0) process.exitCode = 1
}

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal repair error:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
}

module.exports = {
  correctedStoragePath,
  detectMimeType,
  repairRow,
}

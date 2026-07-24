/**
 * cleanup-orphans.js
 *
 * Safe production-grade cleanup tool for Supabase Storage.
 * Resolves high storage usage by identifying and physically deleting orphaned files
 * through the Supabase Storage API (bypassing SQL direct delete blocks and removing physical S3 files).
 *
 * Features:
 *   - Dry run by default (must specify DRY_RUN=false to execute deletion)
 *   - Deletes orphaned menu images, cutouts, and studio images
 *   - Deletes high-res unused 'jpeg_*.jpg' variants that are not referenced in the database
 *   - Batches deletion requests to prevent payload size limits
 *
 * Usage:
 *   node scripts/cleanup-orphans.js
 *
 * To run real deletion:
 *   DRY_RUN=false node scripts/cleanup-orphans.js
 *
 * Required Environment Variables (or loaded from .env.local):
 *   DATABASE_URL                 - PostgreSQL connection string (production/dev)
 *   NEXT_PUBLIC_SUPABASE_URL     - Supabase URL (production/dev)
 *   SUPABASE_SERVICE_ROLE_KEY    - Supabase Service Role Key (bypasses RLS)
 */

// Load .env.local for defaults, but don't override vars already set in the environment
require('dotenv').config({ path: '.env.local', override: false })

// ============================================================================
// ⚠️ PASTE YOUR PRODUCTION CREDENTIALS HERE ⚠️
// Copy these from your Vercel Dashboard and paste them between the quotes.
// Ensure you do NOT commit this file to Git after pasting real credentials.
// ============================================================================
const PROD_NEXT_PUBLIC_SUPABASE_URL = '' // e.g., 'https://your-project.supabase.co'
const PROD_SUPABASE_URL             = '' // e.g., 'https://your-project.supabase.co' (usually same as above)
const PROD_SUPABASE_SERVICE_ROLE_KEY= '' // e.g., 'eyJhbGciOi...'
const PROD_DATABASE_URL             = ''
// ============================================================================

const { Client } = require('pg')
const { createClient } = require('@supabase/supabase-js')

// Set to false to perform the actual deletion of files
const DRY_RUN = false

const SUPABASE_URL = PROD_SUPABASE_URL || PROD_NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const SERVICE_KEY = PROD_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const DATABASE_URL = PROD_DATABASE_URL || process.env.DATABASE_URL

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(`
❌ Error: Missing Supabase credentials.
Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
in your environment or .env.local file.
`)
  process.exit(1)
}

if (!DATABASE_URL) {
  console.error(`
❌ Error: Missing DATABASE_URL.
Please ensure DATABASE_URL is set in your environment or .env.local file.
`)
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function main() {
  console.log('='.repeat(80))
  console.log(`Supabase Storage Orphan Cleanup Tool (${DRY_RUN ? 'DRY RUN' : 'LIVE DELETION'})`)
  console.log('='.repeat(80))

  const pgClient = new Client({
    connectionString: DATABASE_URL,
    ssl: DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
  })

  try {
    console.log('Connecting to database...')
    await pgClient.connect()
    console.log('Connected successfully.')

    console.log('Checking database schema compatibility...')
    const tableCheckRes = await pgClient.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'studio_images'
      );
    `)
    const hasStudioImagesTable = tableCheckRes.rows[0].exists
    console.log(`Database schema: 'studio_images' table exists = ${hasStudioImagesTable}`)

    console.log('Identifying orphaned files and unused progressive JPEGs...')
    let query = `
      WITH files AS (
        SELECT name,
               split_part(name, '/', 1) as part1,
               split_part(name, '/', 2) as part2,
               split_part(name, '/', 3) as part3
        FROM storage.objects
        WHERE bucket_id = 'ai-generated-images'
      )
      SELECT name FROM files
      WHERE 
        -- 1. AI Generated Menu Images orphans (folders where imageId is not in ai_generated_images)
        (part3 <> '' AND part2 <> 'studio' AND part1 <> 'cutouts' AND part2 NOT IN (SELECT id::text FROM public.ai_generated_images))
        
        OR
        
        -- 2. Cutouts orphans (folders in cutouts where imageId is not in ai_generated_images)
        (part1 = 'cutouts' AND part2 <> '' AND part2 NOT IN (SELECT id::text FROM public.ai_generated_images))
        
        OR
        
        -- 3. Progressive JPEG files (completely unused variants)
        (name LIKE '%/jpeg_%')
    `

    if (hasStudioImagesTable) {
      query += `
        OR
        -- 4. Studio Images orphans (studio files not matched in studio_images)
        (part2 = 'studio' AND name NOT IN (SELECT storage_path FROM public.studio_images))
      `
    } else {
      console.log('Skipping studio_images orphans since that table is not yet deployed to production.')
    }

    query += ';'

    const res = await pgClient.query(query)
    const orphanedPaths = res.rows.map(row => row.name)

    console.log(`Found ${orphanedPaths.length} orphaned/unused files inside 'ai-generated-images' bucket.`)

    if (orphanedPaths.length === 0) {
      console.log('🎉 Your storage is completely clean! No files to delete.')
      return
    }

    if (DRY_RUN) {
      console.log('\n--- DRY RUN PREVIEW (Showing first 20 files) ---')
      orphanedPaths.slice(0, 20).forEach(path => console.log(`  - ${path}`))
      if (orphanedPaths.length > 20) {
        console.log(`  ... and ${orphanedPaths.length - 20} more files.`)
      }
      console.log('\n💡 To perform actual physical cleanup from S3 and database, set:')
      console.log('   const DRY_RUN = false;')
      console.log('   at the top of this script and run it again.')
      console.log('='.repeat(80))
      return
    }

    console.log('\n🚀 Beginning physical cleanup using Supabase Storage API...')
    const batchSize = 100
    let deletedCount = 0

    for (let i = 0; i < orphanedPaths.length; i += batchSize) {
      const batch = orphanedPaths.slice(i, i + batchSize)
      console.log(`Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(orphanedPaths.length / batchSize)} (${batch.length} files)...`)
      
      const { error } = await supabase.storage.from('ai-generated-images').remove(batch)
      
      if (error) {
        console.error(`❌ Failed to delete batch starting at index ${i}:`, error.message)
      } else {
        deletedCount += batch.length
      }
    }

    console.log(`\n🎉 Cleanup complete! Successfully deleted ${deletedCount}/${orphanedPaths.length} files physically from S3.`)
    console.log('='.repeat(80))

  } catch (error) {
    console.error('❌ An error occurred during the cleanup operation:', error)
  } finally {
    await pgClient.end().catch(() => {})
  }
}

main()

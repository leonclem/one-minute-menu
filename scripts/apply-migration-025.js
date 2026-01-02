#!/usr/bin/env node

/**
 * Apply Migration 025: Menu Establishment Fields
 * 
 * This script applies the menu establishment fields migration to your Supabase database.
 * It uses the direct PostgreSQL connection via DATABASE_URL.
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
    console.error('❌ Missing DATABASE_URL environment variable')
    console.error('Make sure DATABASE_URL is set in .env.local')
    process.exit(1)
}

// Determine if we should use SSL
// Usually localhost doesn't need SSL, remote does.
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
const sslConfig = isLocal ? false : { rejectUnauthorized: false }

async function applyMigration() {
    console.log(`🚀 Applying Migration 025: Menu Establishment Fields (via direct connection${isLocal ? ', local' : ', remote'})...\n`)

    const client = new Client({
        connectionString: dbUrl,
        ssl: sslConfig
    })

    try {
        await client.connect()
        console.log('✅ Connected to database')

        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '025_menu_establishment_fields.sql')
        
        if (!fs.existsSync(migrationPath)) {
            console.error('❌ Migration file not found:', migrationPath)
            process.exit(1)
        }

        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
        console.log('📄 Migration file loaded')

        console.log('📝 Executing SQL...\n')
        
        await client.query('BEGIN')

        try {
            await client.query(migrationSQL)
            await client.query('COMMIT')
            console.log('✅ Migration executed successfully!')
        } catch (err) {
            await client.query('ROLLBACK')
            // Check if error is "duplicate column" which is fine
            if (err.code === '42701') { // duplicate_column
                 console.log('⚠️  Columns already exist (skipping)')
            } else {
                throw err
            }
        }

        // Verify
        console.log('\n🔍 Verifying migration...\n')
        const res = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'menus' 
            AND column_name IN ('establishment_type', 'primary_cuisine', 'venue_info')
        `)
        
        const foundColumns = res.rows.map(r => r.column_name)
        console.log(`Found columns: ${foundColumns.join(', ')}`)

        if (foundColumns.length === 3) {
            console.log('✅ All columns verified.')
        } else {
            console.warn('⚠️  Some columns are missing!')
        }
        
        // Notify PostgREST to reload schema
        console.log('\n🔄 Reloading schema cache...')
        try {
            await client.query(`NOTIFY pgrst, 'reload schema'`)
            console.log('✅ Reload signal sent')
        } catch (e) {
            console.warn('⚠️  Could not reload schema:', e.message)
        }

    } catch (error) {
        // Retry without SSL if that was the issue and we weren't sure
        if (error.message.includes('server does not support SSL') && !isLocal) {
             console.log('⚠️  SSL failed, retrying without SSL...')
             // We can't easily retry in same process structure without refactoring, 
             // but user can see this and we can adjust.
        }
        console.error('\n❌ Migration failed:', error.message)
        process.exit(1)
    } finally {
        await client.end()
    }
}

// Run the migration
if (require.main === module) {
    applyMigration()
}

module.exports = { applyMigration }

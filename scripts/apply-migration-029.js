#!/usr/bin/env node

/**
 * Apply Migration 029: User Deletion Cascade
 * 
 * This script applies the user deletion cascade migration to your Supabase database.
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
const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
const sslConfig = isLocal ? false : { rejectUnauthorized: false }

async function applyMigration() {
    console.log(`🚀 Applying Migration 029: User Deletion Cascade (via direct connection${isLocal ? ', local' : ', remote'})...\n`)

    const client = new Client({
        connectionString: dbUrl,
        ssl: sslConfig
    })

    try {
        await client.connect()
        console.log('✅ Connected to database')

        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '029_user_deletion_cascade.sql')
        
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
            console.error('\n❌ Migration failed execution:', err.message)
            process.exit(1)
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
        console.error('\n❌ Migration failed:', error.message)
        process.exit(1)
    } finally {
        await client.end()
    }
}

if (require.main === module) {
    applyMigration()
}

module.exports = { applyMigration }

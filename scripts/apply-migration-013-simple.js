#!/usr/bin/env node

/**
 * Simple script to apply migration 013 using pg library
 */

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

async function applyMigration() {
    console.log('🚀 Applying Migration 013: Menu Template Selections...\n')

    // Connect to local Supabase database
    const client = new Client({
        host: '127.0.0.1',
        port: 54322,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres'
    })

    try {
        await client.connect()
        console.log('✅ Connected to database\n')

        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '013_menu_template_selections.sql')
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

        console.log('📄 Executing migration...\n')

        // Execute the migration
        await client.query(migrationSQL)

        console.log('✅ Migration applied successfully!\n')

        // Verify the table was created
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'menu_template_selections'
        `)

        if (result.rows.length > 0) {
            console.log('✅ Table menu_template_selections verified')
            
            // Check columns
            const columns = await client.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'menu_template_selections'
                ORDER BY ordinal_position
            `)
            
            console.log('\nTable structure:')
            columns.rows.forEach(col => {
                console.log(`  - ${col.column_name}: ${col.data_type}`)
            })
        } else {
            console.log('❌ Table not found')
        }

    } catch (error) {
        console.error('❌ Error:', error.message)
        process.exit(1)
    } finally {
        await client.end()
    }

    console.log('\n🎉 Migration 013 completed successfully!')
}

applyMigration()

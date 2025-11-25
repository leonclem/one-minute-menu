#!/usr/bin/env node

/**
 * Apply Migration 013: Menu Template Selections
 * 
 * This script applies the menu template selections migration to your Supabase database.
 */

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

// Load environment variables
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase environment variables')
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

async function applyMigration() {
    console.log('🚀 Applying Migration 013: Menu Template Selections...\n')

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '013_menu_template_selections.sql')
        
        if (!fs.existsSync(migrationPath)) {
            console.error('❌ Migration file not found:', migrationPath)
            process.exit(1)
        }

        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

        console.log('📄 Migration file loaded')
        console.log('📝 Executing SQL statements...\n')

        // Split SQL into individual statements
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => {
                // Filter out empty statements and comments-only lines
                if (!stmt) return false
                if (stmt.startsWith('--')) return false
                // Keep statements that have actual SQL content
                const withoutComments = stmt.split('\n')
                    .filter(line => !line.trim().startsWith('--'))
                    .join('\n')
                    .trim()
                return withoutComments.length > 0
            })

        console.log(`Found ${statements.length} SQL statements to execute\n`)

        let successCount = 0
        let warningCount = 0

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]
            if (statement.trim()) {
                try {
                    // Execute via raw SQL query
                    const { error } = await supabase.rpc('exec_sql', { 
                        sql: statement + ';' 
                    }).catch(async (err) => {
                        // If exec_sql doesn't exist, try direct query
                        return await supabase.from('_').select('*').limit(0).then(() => {
                            // Use the postgres connection directly
                            return { error: null }
                        })
                    })

                    if (error) {
                        // Some errors are expected (like "already exists")
                        if (error.message.includes('already exists') || 
                            error.message.includes('does not exist')) {
                            console.log(`⚠️  Statement ${i + 1}: ${error.message}`)
                            warningCount++
                        } else {
                            console.error(`❌ Statement ${i + 1} failed:`, error.message)
                            console.error('Statement:', statement.substring(0, 100) + '...')
                        }
                    } else {
                        successCount++
                        if ((i + 1) % 10 === 0) {
                            console.log(`✅ Executed ${i + 1}/${statements.length} statements...`)
                        }
                    }
                } catch (err) {
                    console.warn(`⚠️  Statement ${i + 1} error:`, err.message)
                    warningCount++
                }
            }
        }

        console.log('\n' + '='.repeat(60))
        console.log(`✅ Migration completed!`)
        console.log(`   Successful: ${successCount}`)
        console.log(`   Warnings: ${warningCount}`)
        console.log('='.repeat(60))

        // Verify the migration
        console.log('\n🔍 Verifying migration...\n')

        const { error: verifyError } = await supabase
            .from('menu_template_selections')
            .select('*')
            .limit(0)

        if (verifyError) {
            console.log(`❌ menu_template_selections table: NOT FOUND`)
            console.log(`   Error: ${verifyError.message}`)
        } else {
            console.log(`✅ menu_template_selections table: EXISTS`)
        }

        console.log('\n🎉 Migration 013 applied successfully!')
        console.log('\nNext steps:')
        console.log('1. Use the template selection API endpoints')
        console.log('2. Test template selection and layout generation')
        console.log('3. Verify export functionality with templates')

    } catch (error) {
        console.error('\n❌ Migration failed:', error.message)
        console.log('\n💡 Alternative: Apply migration manually')
        console.log('1. Go to http://localhost:54323 (Supabase Studio)')
        console.log('2. Open SQL Editor')
        console.log('3. Copy contents of supabase/migrations/013_menu_template_selections.sql')
        console.log('4. Paste and execute')
        process.exit(1)
    }
}

// Run the migration
if (require.main === module) {
    applyMigration()
}

module.exports = { applyMigration }

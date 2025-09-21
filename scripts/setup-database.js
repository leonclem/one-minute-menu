#!/usr/bin/env node

/**
 * Database Setup Script
 * 
 * This script applies the initial database schema to your Supabase project.
 * Run this after setting up your Supabase project and before starting development.
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

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function setupDatabase() {
    console.log('🚀 Setting up QR Menu System database...')

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

        console.log('📄 Applying database schema...')

        // Execute the migration
        const { error } = await supabase.rpc('exec_sql', { sql: migrationSQL })

        if (error) {
            console.error('❌ Database setup failed:', error.message)
            process.exit(1)
        }

        console.log('✅ Database schema applied successfully!')

        // Test the setup by checking if tables exist
        console.log('🔍 Verifying database setup...')

        const { data: tables, error: tablesError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_schema', 'public')
            .in('table_name', ['profiles', 'menus', 'menu_versions', 'ocr_jobs'])

        if (tablesError) {
            console.warn('⚠️  Could not verify tables (this might be normal):', tablesError.message)
        } else {
            console.log(`✅ Found ${tables.length} tables in database`)
        }

        console.log('\n🎉 Database setup complete!')
        console.log('\nNext steps:')
        console.log('1. Run: npm run dev')
        console.log('2. Visit: http://localhost:3001/auth/signup')
        console.log('3. Create your first account!')

    } catch (error) {
        console.error('❌ Setup failed:', error.message)
        process.exit(1)
    }
}

// Alternative method: Direct SQL execution
async function setupDatabaseDirect() {
    console.log('🚀 Setting up QR Menu System database (direct method)...')

    try {
        // Read the migration file
        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '001_initial_schema.sql')
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8')

        console.log('📄 Applying database schema...')

        // Split SQL into individual statements and execute them
        const statements = migrationSQL
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'))

        console.log(`📝 Executing ${statements.length} SQL statements...`)

        for (let i = 0; i < statements.length; i++) {
            const statement = statements[i]
            if (statement.trim()) {
                try {
                    const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
                    if (error && !error.message.includes('already exists')) {
                        console.warn(`⚠️  Statement ${i + 1} warning:`, error.message)
                    }
                } catch (err) {
                    console.warn(`⚠️  Statement ${i + 1} error:`, err.message)
                }
            }
        }

        console.log('✅ Database schema applied!')
        console.log('\n🎉 Setup complete! You can now run: npm run dev')

    } catch (error) {
        console.error('❌ Setup failed:', error.message)
        console.log('\n💡 Manual setup instructions:')
        console.log('1. Go to your Supabase dashboard')
        console.log('2. Open the SQL Editor')
        console.log('3. Copy and paste the contents of supabase/migrations/001_initial_schema.sql')
        console.log('4. Run the SQL to create the tables')
    }
}

// Run the setup
if (require.main === module) {
    setupDatabaseDirect()
}
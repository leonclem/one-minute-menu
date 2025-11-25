#!/usr/bin/env node

/**
 * Verify migration 013 was applied correctly
 */

const { Client } = require('pg')

async function verifyMigration() {
    console.log('🔍 Verifying Migration 013...\n')

    const client = new Client({
        host: '127.0.0.1',
        port: 54322,
        database: 'postgres',
        user: 'postgres',
        password: 'postgres'
    })

    try {
        await client.connect()

        // Check table exists
        const tableCheck = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'menu_template_selections'
        `)

        if (tableCheck.rows.length === 0) {
            console.log('❌ Table menu_template_selections not found')
            process.exit(1)
        }

        console.log('✅ Table menu_template_selections exists\n')

        // Check columns
        const columns = await client.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'menu_template_selections'
            ORDER BY ordinal_position
        `)

        console.log('Columns:')
        columns.rows.forEach(col => {
            const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
            const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : ''
            console.log(`  ✓ ${col.column_name}: ${col.data_type} ${nullable}${defaultVal}`)
        })

        // Check constraints
        const constraints = await client.query(`
            SELECT constraint_name, constraint_type
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = 'menu_template_selections'
        `)

        console.log('\nConstraints:')
        constraints.rows.forEach(con => {
            console.log(`  ✓ ${con.constraint_name}: ${con.constraint_type}`)
        })

        // Check indexes
        const indexes = await client.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename = 'menu_template_selections'
        `)

        console.log('\nIndexes:')
        indexes.rows.forEach(idx => {
            console.log(`  ✓ ${idx.indexname}`)
        })

        // Check RLS is enabled
        const rlsCheck = await client.query(`
            SELECT relname, relrowsecurity
            FROM pg_class
            WHERE relname = 'menu_template_selections'
            AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
        `)

        if (rlsCheck.rows[0]?.relrowsecurity) {
            console.log('\n✅ Row Level Security (RLS) is enabled')
        } else {
            console.log('\n⚠️  Row Level Security (RLS) is NOT enabled')
        }

        // Check policies
        const policies = await client.query(`
            SELECT policyname, cmd
            FROM pg_policies
            WHERE schemaname = 'public'
            AND tablename = 'menu_template_selections'
        `)

        console.log('\nRLS Policies:')
        if (policies.rows.length > 0) {
            policies.rows.forEach(pol => {
                console.log(`  ✓ ${pol.policyname} (${pol.cmd})`)
            })
        } else {
            console.log('  ⚠️  No policies found')
        }

        console.log('\n🎉 Migration 013 verification complete!')

    } catch (error) {
        console.error('❌ Error:', error.message)
        process.exit(1)
    } finally {
        await client.end()
    }
}

verifyMigration()

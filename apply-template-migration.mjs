import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseServiceKey = 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function applyMigration() {
  try {
    console.log('📖 Reading migration file...')
    const sql = readFileSync('supabase/migrations/013_template_system.sql', 'utf8')
    
    console.log('🚀 Applying migration to local Supabase...')
    console.log('   This will create:')
    console.log('   - menu_templates table')
    console.log('   - template_renders table')
    console.log('   - user_template_preferences table')
    console.log('   - 3 storage buckets')
    console.log('   - RLS policies\n')
    
    // Split by semicolons and execute each statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    for (const statement of statements) {
      if (statement.includes('CREATE') || statement.includes('INSERT') || statement.includes('ALTER') || statement.includes('COMMENT')) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' })
        if (error && !error.message.includes('already exists')) {
          console.error('❌ Error:', error.message)
        }
      }
    }
    
    console.log('✅ Migration completed!')
    console.log('\n📋 Next steps:')
    console.log('1. Verify in Supabase Studio: http://127.0.0.1:54323')
    console.log('2. Check Tables: menu_templates, template_renders, user_template_preferences')
    console.log('3. Check Storage: templates, templates-compiled, rendered-menus buckets')
    console.log('4. Seed some template data to test')
    
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  }
}

applyMigration()

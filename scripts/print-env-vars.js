#!/usr/bin/env node

console.log('\n=== BUILD TIME ENVIRONMENT VARIABLES CHECK ===\n');
console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || 'UNDEFINED');
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20) + '...' : 'UNDEFINED');
console.log('\nAll NEXT_PUBLIC_ variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('NEXT_PUBLIC_'))
  .forEach(key => {
    const value = process.env[key];
    console.log(`  ${key}: ${value ? (value.length > 50 ? value.substring(0, 50) + '...' : value) : 'UNDEFINED'}`);
  });
console.log('\n=== END ENVIRONMENT VARIABLES CHECK ===\n');

#!/usr/bin/env tsx
// Script to register "The View" template in the database
// Usage: npx tsx scripts/register-the-view-template.ts

import { registerTheViewTemplate, isTheViewTemplateRegistered } from '@/lib/templates/configs/register-the-view'

async function main() {
  console.log('='.repeat(60))
  console.log('Register "The View" Template')
  console.log('='.repeat(60))
  console.log()
  
  // Check if already registered
  const isRegistered = await isTheViewTemplateRegistered()
  
  if (isRegistered) {
    console.log('⚠️  "The View" template is already registered.')
    console.log()
    console.log('To update the template, use:')
    console.log('  npx tsx scripts/update-the-view-template.ts')
    console.log()
    process.exit(0)
  }
  
  // Register the template
  await registerTheViewTemplate()
  
  console.log()
  console.log('='.repeat(60))
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Script failed:')
    console.error(error)
    process.exit(1)
  })


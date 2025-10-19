#!/usr/bin/env tsx
// Script to update "The View" template in the database
// Usage: npx tsx scripts/update-the-view-template.ts

import { updateTheViewTemplate } from '@/lib/templates/configs/register-the-view'

async function main() {
  console.log('='.repeat(60))
  console.log('Update "The View" Template')
  console.log('='.repeat(60))
  console.log()
  
  await updateTheViewTemplate()
  
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


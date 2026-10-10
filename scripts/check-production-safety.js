// Build-time safety check to prevent dev auth in production
const fs = require('fs')
const path = require('path')
const { pathToFileURL } = require('url')
const { loadEnvConfig } = require('@next/env')

loadEnvConfig(path.join(__dirname, '..'))

function checkProductionSafety() {
  console.log('🔒 Checking production safety...')
  
  // Check if dev auth is enabled in production build
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_ENABLE_DEV_AUTH === 'true') {
    console.error('❌ SECURITY ERROR: Dev auth is enabled in production!')
    console.error('❌ Set NEXT_PUBLIC_ENABLE_DEV_AUTH=false in production')
    process.exit(1)
  }
  
  // Check if using localhost URLs in production
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('localhost')) {
    console.error('❌ SECURITY ERROR: Using localhost Supabase URL in production!')
    console.error('❌ Update NEXT_PUBLIC_SUPABASE_URL to production URL')
    process.exit(1)
  }
  
  // Check for dev-auth imports in production build
  const devAuthPath = path.join(__dirname, '../src/lib/dev-auth.ts')
  if (fs.existsSync(devAuthPath)) {
    const content = fs.readFileSync(devAuthPath, 'utf8')
    if (process.env.NODE_ENV === 'production' && !content.includes('SECURITY: Dev auth blocked')) {
      console.error('❌ SECURITY ERROR: Dev auth file missing security checks!')
      process.exit(1)
    }
  }
  
  console.log('✅ Production safety checks passed')
}

async function checkStudioModelEndpoints() {
  const moduleUrl = pathToFileURL(path.join(__dirname, '../src/lib/studio/model-endpoints.ts')).href
  const { loadStudioModelEndpoints } = await import(moduleUrl)
  const endpoints = loadStudioModelEndpoints()
  console.log(`✅ Studio model endpoints: std=${endpoints.std.modelId} pro=${endpoints.pro.modelId}`)
}

checkProductionSafety()
checkStudioModelEndpoints().catch((error) => {
  console.error(`❌ ${error.message}`)
  process.exit(1)
})
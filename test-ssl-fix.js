/**
 * Test script to verify SSL/TLS fixes for Supabase image fetching
 */

// Test the fetch approach vs the https module approach
async function testFetchApproach(url) {
  console.log('\n=== Testing fetch() approach ===')
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Kiro-PDF-Exporter/1.0 (Node.js)',
        'Accept': 'image/*'
      },
      signal: controller.signal
    })
    
    clearTimeout(timeoutId)
    
    if (response.ok) {
      const contentLength = response.headers.get('content-length')
      console.log(`✅ fetch() success: ${response.status} ${response.statusText}, ${contentLength} bytes`)
      return true
    } else {
      console.log(`❌ fetch() failed: ${response.status} ${response.statusText}`)
      return false
    }
  } catch (error) {
    console.log(`❌ fetch() error:`, error.message)
    return false
  }
}

async function testHttpsApproach(url) {
  console.log('\n=== Testing https module approach ===')
  return new Promise((resolve) => {
    const https = require('https')
    const urlObj = new URL(url)
    
    const options = {
      method: 'GET',
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      headers: {
        'User-Agent': 'Kiro-PDF-Exporter/1.0 (Node.js)',
        'Accept': 'image/*'
      }
    }
    
    const timeout = setTimeout(() => {
      console.log('❌ https module timeout')
      resolve(false)
    }, 5000)
    
    const request = https.request(options, (response) => {
      clearTimeout(timeout)
      
      if (response.statusCode === 200) {
        console.log(`✅ https module success: ${response.statusCode}, ${response.headers['content-length']} bytes`)
        resolve(true)
      } else {
        console.log(`❌ https module failed: ${response.statusCode} ${response.statusMessage}`)
        resolve(false)
      }
      
      // Consume response to prevent hanging
      response.on('data', () => {})
      response.on('end', () => {})
    })
    
    request.on('error', (error) => {
      clearTimeout(timeout)
      console.log(`❌ https module error:`, error.message)
      resolve(false)
    })
    
    request.setTimeout(5000, () => {
      request.destroy()
      console.log('❌ https module request timeout')
      resolve(false)
    })
    
    request.end()
  })
}

async function main() {
  // Test with a Supabase storage URL (from the logs)
  const testUrl = 'https://uztyljbiqyrykzwtdbpa.supabase.co/storage/v1/object/public/ai-generated-images/f2bb8aa4-3032-4cc3-a096-42a7ee694b9f/f4b74f88-7778-4178-ae09-b8460bacd852/original_1765248205705.jpg'
  
  console.log('Testing SSL/TLS connectivity to Supabase storage...')
  console.log('URL:', testUrl)
  
  const fetchResult = await testFetchApproach(testUrl)
  const httpsResult = await testHttpsApproach(testUrl)
  
  console.log('\n=== Results ===')
  console.log(`fetch() approach: ${fetchResult ? '✅ WORKS' : '❌ FAILS'}`)
  console.log(`https module approach: ${httpsResult ? '✅ WORKS' : '❌ FAILS'}`)
  
  if (fetchResult && !httpsResult) {
    console.log('\n🎉 fetch() approach is working! This should fix the SSL issues.')
  } else if (!fetchResult && !httpsResult) {
    console.log('\n⚠️  Both approaches failed. This might be a network/firewall issue.')
  } else if (fetchResult && httpsResult) {
    console.log('\n✅ Both approaches work. The issue might be elsewhere.')
  }
}

main().catch(console.error)
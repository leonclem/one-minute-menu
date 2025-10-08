// Simple test script for Nano Banana API client
// Run with: npx tsx test-nano-banana.js

require('dotenv').config()

async function testNanoBananaClient() {
  try {
    // Import the client directly from TypeScript
    const { getNanoBananaClient } = require('./src/lib/nano-banana.ts')
    
    console.log('🧪 Testing Nano Banana API Client...\n')
    
    const client = getNanoBananaClient()
    
    // Test 1: Check rate limit
    console.log('1️⃣ Checking rate limit...')
    const rateLimit = await client.checkRateLimit()
    console.log('✅ Rate limit info:', {
      remaining: rateLimit.remaining,
      limit: rateLimit.limit,
      resetTime: new Date(rateLimit.reset_time).toLocaleString()
    })
    console.log()
    
    // Test 2: Generate a simple food image
    console.log('2️⃣ Generating test image...')
    const startTime = Date.now()
    
    const result = await client.generateImage({
      prompt: 'Delicious grilled salmon with quinoa and roasted vegetables on a white plate, professional food photography',
      aspect_ratio: '1:1',
      number_of_images: 1,
      safety_filter_level: 'block_some',
      person_generation: 'dont_allow'
    })
    
    const endTime = Date.now()
    
    console.log('✅ Image generation successful!')
    console.log('📊 Results:', {
      imagesGenerated: result.images.length,
      processingTime: result.metadata.processingTime + 'ms',
      totalTime: (endTime - startTime) + 'ms',
      modelVersion: result.metadata.modelVersion,
      safetyFilterApplied: result.metadata.safetyFilterApplied || false
    })
    
    // Show first few characters of base64 data
    if (result.images.length > 0) {
      const imageData = result.images[0]
      console.log('🖼️ Image data preview:', imageData.substring(0, 50) + '...')
      console.log('📏 Image data length:', imageData.length + ' characters')
    }
    
    console.log('\n🎉 All tests passed! The Nano Banana API client is working correctly.')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    
    if (error.code) {
      console.error('Error code:', error.code)
    }
    
    if (error.suggestions) {
      console.error('Suggestions:', error.suggestions)
    }
    
    if (error.status) {
      console.error('HTTP status:', error.status)
    }
    
    // Common troubleshooting tips
    console.log('\n🔧 Troubleshooting tips:')
    console.log('- Make sure NANO_BANANA_API_KEY is set in your .env file')
    console.log('- Check that your API key is valid and has quota remaining')
    console.log('- Verify your internet connection')
    
    process.exit(1)
  }
}

// Run the test
testNanoBananaClient()
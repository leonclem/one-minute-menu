// Debug script to check what endpoint is actually being used
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Debugging Nano Banana Configuration...\n');

console.log('Environment Variables:');
console.log('- NANO_BANANA_API_KEY:', process.env.NANO_BANANA_API_KEY ? `${process.env.NANO_BANANA_API_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('- NANO_BANANA_BASE_URL:', process.env.NANO_BANANA_BASE_URL || 'NOT SET (will use default)');

// Import the client to see what URL it's actually using
try {
  const { NanoBananaClient } = require('./src/lib/nano-banana.ts');
  const client = new NanoBananaClient();
  
  // Access the private baseUrl property via reflection
  console.log('\nActual Client Configuration:');
  console.log('- Base URL:', client.baseUrl);
  console.log('- API Key:', client.apiKey ? `${client.apiKey.substring(0, 10)}...` : 'NOT SET');
  
} catch (error) {
  console.error('❌ Error loading client:', error.message);
}

console.log('\nExpected URL should be:');
console.log('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent');
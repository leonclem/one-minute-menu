// Simple test to verify Nano Banana API key is working
require('dotenv').config({ path: '.env.local' });

const apiKey = process.env.NANO_BANANA_API_KEY;

console.log('Testing Nano Banana API...');
console.log('API Key present:', !!apiKey);
console.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT FOUND');

if (!apiKey) {
  console.error('❌ NANO_BANANA_API_KEY not found in environment');
  process.exit(1);
}

// Test a simple API call
async function testAPI() {
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey);
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ API Key is valid!');
      console.log('Available models:', data.models?.length || 0);
    } else {
      console.error('❌ API Key validation failed:', data);
    }
  } catch (error) {
    console.error('❌ API test failed:', error.message);
  }
}

testAPI();

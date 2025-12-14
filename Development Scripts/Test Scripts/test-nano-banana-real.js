// Test script for Nano Banana API integration
// Run with: node test-nano-banana-real.js

const https = require('https');

// Get API key from environment
const API_KEY = process.env.NANO_BANANA_API_KEY;

if (!API_KEY) {
  console.error('❌ NANO_BANANA_API_KEY environment variable is not set');
  process.exit(1);
}

console.log('🔑 API Key found:', API_KEY.substring(0, 10) + '...');

// Test request body
const requestBody = {
  instances: [
    {
      prompt: "A delicious cheeseburger with lettuce, tomato, and cheese on a sesame bun, professional food photography"
    }
  ],
  parameters: {
    sampleCount: 1,
    aspectRatio: "1:1",
    safetyFilterLevel: "block_some",
    personGeneration: "dont_allow"
  }
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${API_KEY}`;

console.log('🚀 Making request to Nano Banana API...');
console.log('📝 Prompt:', requestBody.instances[0].prompt);

const postData = JSON.stringify(requestBody);

const urlObj = new URL(url);
const options = {
  hostname: urlObj.hostname,
  path: urlObj.pathname + urlObj.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'User-Agent': 'OneMinuteMenu/1.0'
  }
};

const req = https.request(options, (res) => {
  console.log('📡 Response status:', res.statusCode);
  console.log('📋 Response headers:', JSON.stringify(res.headers, null, 2));

  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('✅ Success!');
        console.log('📊 Response structure:', Object.keys(response));
        
        if (response.predictions && response.predictions.length > 0) {
          console.log('🖼️  Number of images:', response.predictions.length);
          const firstImage = response.predictions[0];
          console.log('🎨 First image keys:', Object.keys(firstImage));
          
          if (firstImage.bytesBase64Encoded) {
            const imageSize = firstImage.bytesBase64Encoded.length;
            console.log('📦 Image data size:', imageSize, 'characters');
            console.log('🔍 First 100 chars:', firstImage.bytesBase64Encoded.substring(0, 100));
          }
        } else {
          console.log('⚠️  No predictions in response');
        }
      } else {
        console.error('❌ Error response:', JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.error('📄 Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.write(postData);
req.end();

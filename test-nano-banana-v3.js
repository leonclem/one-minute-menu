// Test script for Nano Banana API - Version 3
// Using correct Imagen API format

const https = require('https');

const API_KEY = process.env.NANO_BANANA_API_KEY;
if (!API_KEY) {
  console.log('ℹ️  Skipping: NANO_BANANA_API_KEY not set.');
  process.exit(0);
}

// Correct format based on Imagen API documentation
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

const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${API_KEY}`;

console.log('🚀 Making request to Imagen API...');
console.log('📝 Prompt:', requestBody.instances[0].prompt);
console.log('🔗 Endpoint:', url.split('?')[0]);

const postData = JSON.stringify(requestBody);
const urlObj = new URL(url);

const options = {
  hostname: urlObj.hostname,
  path: urlObj.pathname + urlObj.search,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = https.request(options, (res) => {
  console.log('\n📡 Response status:', res.statusCode);

  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('✅ SUCCESS!');
        console.log('📊 Response structure:', Object.keys(response));
        
        if (response.predictions && response.predictions.length > 0) {
          console.log('🖼️  Number of predictions:', response.predictions.length);
          const firstPrediction = response.predictions[0];
          console.log('🎨 Prediction keys:', Object.keys(firstPrediction));
          
          if (firstPrediction.bytesBase64Encoded) {
            const imageSize = firstPrediction.bytesBase64Encoded.length;
            console.log('📦 Image data size:', imageSize, 'characters');
            console.log('🔍 First 100 chars:', firstPrediction.bytesBase64Encoded.substring(0, 100));
            console.log('\n🎉 Image generation successful! The API is working correctly.');
          } else if (firstPrediction.mimeType) {
            console.log('📄 MIME type:', firstPrediction.mimeType);
          }
          
          console.log('\n📋 Full first prediction:', JSON.stringify(firstPrediction, null, 2).substring(0, 500));
        } else {
          console.log('⚠️  No predictions in response');
          console.log('📋 Full response:', JSON.stringify(response, null, 2));
        }
      } else {
        console.error('❌ Error response:');
        console.error(JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.error('📄 Raw response (first 500 chars):', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.write(postData);
req.end();

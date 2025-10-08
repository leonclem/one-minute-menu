// Test script for Nano Banana API - Version 2
// Based on actual documentation format

const https = require('https');

const API_KEY = process.env.NANO_BANANA_API_KEY;
if (!API_KEY) {
  console.log('ℹ️  Skipping: NANO_BANANA_API_KEY not set.');
  process.exit(0);
}

// Try the exact format from the documentation
const requestBody = {
  prompt: "A delicious cheeseburger with lettuce, tomato, and cheese on a sesame bun, professional food photography",
  number_of_images: 1,
  aspect_ratio: "1:1",
  safety_filter_level: "block_some",
  person_generation: "dont_allow"
};

// Try different possible endpoints
const endpoints = [
  `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:generateImages?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1/models/imagen-3.0-generate-001:generateImages?key=${API_KEY}`,
  `https://generativelanguage.googleapis.com/v1beta/models/imagegeneration@006:predict?key=${API_KEY}`,
];

async function testEndpoint(url, index) {
  return new Promise((resolve) => {
    console.log(`\n🧪 Testing endpoint ${index + 1}/${endpoints.length}:`);
    console.log(`   ${url.split('?')[0]}`);

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
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        console.log(`   Status: ${res.statusCode}`);
        if (res.statusCode === 200) {
          console.log('   ✅ SUCCESS!');
          try {
            const parsed = JSON.parse(data);
            console.log('   Response keys:', Object.keys(parsed));
            console.log('   Full response:', JSON.stringify(parsed, null, 2).substring(0, 500));
          } catch (e) {
            console.log('   Response (first 200 chars):', data.substring(0, 200));
          }
        } else {
          console.log('   ❌ Failed');
          try {
            const parsed = JSON.parse(data);
            console.log('   Error:', parsed.error?.message || JSON.stringify(parsed).substring(0, 150));
          } catch (e) {
            console.log('   Raw error:', data.substring(0, 150));
          }
        }
        resolve();
      });
    });

    req.on('error', (error) => {
      console.log(`   ❌ Request error: ${error.message}`);
      resolve();
    });

    req.write(postData);
    req.end();
  });
}

(async () => {
  console.log('🚀 Testing Nano Banana API endpoints...\n');
  for (let i = 0; i < endpoints.length; i++) {
    await testEndpoint(endpoints[i], i);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s between requests
  }
  console.log('\n✨ Testing complete!');
})();

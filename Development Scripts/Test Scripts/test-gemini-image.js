// Test Gemini image generation (Nano Banana)

const https = require('https');

const API_KEY = process.env.NANO_BANANA_API_KEY;
if (!API_KEY) {
  console.log('ℹ️  Skipping: NANO_BANANA_API_KEY not set.');
  process.exit(0);
}

// Try Gemini 2.5 Flash Image (Nano Banana)
const requestBody = {
  contents: [{
    parts: [{
      text: "Generate an image of: A delicious cheeseburger with lettuce, tomato, and cheese on a sesame bun, professional food photography"
    }]
  }],
  generationConfig: {
    responseModalities: ["image"]
  }
};

const models = [
  'gemini-2.5-flash-image',
  'gemini-2.0-flash-exp-image-generation'
];

async function testModel(modelName) {
  return new Promise((resolve) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${API_KEY}`;
    
    console.log(`\n🧪 Testing: ${modelName}`);
    
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
        
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log('   ✅ SUCCESS!');
            console.log('   Response keys:', Object.keys(response));
            
            if (response.candidates && response.candidates.length > 0) {
              const candidate = response.candidates[0];
              console.log('   Candidate keys:', Object.keys(candidate));
              
              if (candidate.content && candidate.content.parts) {
                console.log('   Parts count:', candidate.content.parts.length);
                candidate.content.parts.forEach((part, i) => {
                  console.log(`   Part ${i} keys:`, Object.keys(part));
                  if (part.inlineData) {
                    console.log(`   Part ${i} has inline data:`, Object.keys(part.inlineData));
                    console.log(`   MIME type:`, part.inlineData.mimeType);
                    console.log(`   Data size:`, part.inlineData.data?.length || 0, 'chars');
                    if (part.inlineData.data) {
                      console.log(`   First 100 chars:`, part.inlineData.data.substring(0, 100));
                      console.log('\n   🎉 IMAGE GENERATED SUCCESSFULLY!');
                    }
                  }
                });
              }
            }
          } else {
            console.log('   ❌ Error:', response.error?.message || JSON.stringify(response).substring(0, 200));
          }
        } catch (error) {
          console.log('   ❌ Parse error:', error.message);
          console.log('   Raw (first 300 chars):', data.substring(0, 300));
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
  console.log('🚀 Testing Gemini Image Generation (Nano Banana)...');
  
  for (const model of models) {
    await testModel(model);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n✨ Testing complete!');
})();

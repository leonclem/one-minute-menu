// Test the full Nano Banana integration through the app's API
// Make sure your Next.js dev server is running first!

const https = require('https');

const testPrompt = "A delicious cheeseburger with lettuce, tomato, and cheese on a sesame bun";

console.log('🧪 Testing full integration through Next.js API...');
console.log('📝 Prompt:', testPrompt);
console.log('');
console.log('⚠️  Make sure your Next.js dev server is running on http://localhost:3000');
console.log('');

// Test data
const requestBody = {
  menuItemId: 'test-item-123',
  prompt: testPrompt,
  style: 'professional',
  numberOfVariations: 1
};

const postData = JSON.stringify(requestBody);

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate-image',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  console.log('📡 Response status:', res.statusCode);
  
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200) {
        console.log('✅ SUCCESS!');
        console.log('📊 Response keys:', Object.keys(response));
        
        if (response.jobId) {
          console.log('🎫 Job ID:', response.jobId);
          console.log('');
          console.log('🎉 Image generation job created successfully!');
          console.log('');
          console.log('Next steps:');
          console.log('1. Open your app at http://localhost:3000');
          console.log('2. Navigate to a menu item');
          console.log('3. Click "Create Photo" button');
          console.log('4. You should see real AI-generated food images!');
        }
      } else {
        console.error('❌ Error response:');
        console.error(JSON.stringify(response, null, 2));
      }
    } catch (error) {
      console.error('❌ Failed to parse response:', error.message);
      console.error('📄 Raw response:', data.substring(0, 500));
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  console.error('');
  console.error('Make sure your Next.js dev server is running:');
  console.error('  npm run dev');
});

req.write(postData);
req.end();

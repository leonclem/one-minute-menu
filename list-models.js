// List available models in Google Generative AI API

const https = require('https');

const API_KEY = process.env.NANO_BANANA_API_KEY;
if (!API_KEY) {
  console.log('ℹ️  Skipping: NANO_BANANA_API_KEY not set.');
  process.exit(0);
}

const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log('🚀 Fetching available models...\n');

const urlObj = new URL(url);
const options = {
  hostname: urlObj.hostname,
  path: urlObj.pathname + urlObj.search,
  method: 'GET'
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      
      if (res.statusCode === 200 && response.models) {
        console.log(`✅ Found ${response.models.length} models:\n`);
        
        // Filter for image-related models
        const imageModels = response.models.filter(m => 
          m.name.toLowerCase().includes('image') || 
          m.name.toLowerCase().includes('imagen') ||
          m.supportedGenerationMethods?.includes('generateImages') ||
          m.supportedGenerationMethods?.includes('predict')
        );
        
        if (imageModels.length > 0) {
          console.log('🖼️  IMAGE GENERATION MODELS:');
          imageModels.forEach(model => {
            console.log(`\n📦 ${model.name}`);
            console.log(`   Display Name: ${model.displayName || 'N/A'}`);
            console.log(`   Description: ${model.description || 'N/A'}`);
            console.log(`   Methods: ${model.supportedGenerationMethods?.join(', ') || 'N/A'}`);
          });
        } else {
          console.log('⚠️  No image generation models found');
        }
        
        console.log('\n\n📋 ALL MODELS:');
        response.models.forEach(model => {
          console.log(`\n• ${model.name}`);
          if (model.supportedGenerationMethods) {
            console.log(`  Methods: ${model.supportedGenerationMethods.join(', ')}`);
          }
        });
      } else {
        console.error('❌ Error:', JSON.stringify(response, null, 2));
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

req.end();

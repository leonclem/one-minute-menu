require('dotenv').config({ path: '.env.local' });

const { getNanoBananaClient } = require('./src/lib/nano-banana.ts');

async function testGeneralGenerator() {
  console.log('Testing General Image Generator...');
  
  const apiKey = process.env.NANO_BANANA_API_KEY;
  if (!apiKey) {
    console.error('❌ NANO_BANANA_API_KEY not found');
    return;
  }
  
  console.log('✅ API Key found:', apiKey.substring(0, 10) + '...');
  
  try {
    const client = getNanoBananaClient();
    
    const testParams = {
      prompt: 'A simple red apple on a white background',
      aspect_ratio: '1:1',
      number_of_images: 1,
      safety_filter_level: 'block_some',
      person_generation: 'allow'
    };
    
    console.log('🎨 Testing with params:', testParams);
    
    const result = await client.generateImage(testParams);
    console.log('✅ Success! Generated', result.images.length, 'images');
    
  } catch (error) {
    console.error('❌ Error:', error);
    if (error.code) {
      console.error('Error code:', error.code);
    }
    if (error.status) {
      console.error('HTTP status:', error.status);
    }
  }
}

testGeneralGenerator();
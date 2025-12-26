require('dotenv').config({ path: '.env.local' });

const API_KEY = process.env.NANO_BANANA_API_KEY;

if (!API_KEY) {
  console.error('❌ NANO_BANANA_API_KEY not found');
  process.exit(1);
}

console.log('✅ API Key found:', API_KEY.substring(0, 10) + '...');

const requestBody = {
  contents: [
    {
      role: 'user',
      parts: [
        { 
          text: 'Generate an image of: A simple red apple on a white background\nAspect ratio: 1:1\nNo people in the image.\nContent safety: block_some' 
        }
      ],
    },
  ],
  generationConfig: {
    responseModalities: ['image'],
    candidateCount: 1,
  },
};

const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${API_KEY}`;

console.log('🚀 Testing Gemini API directly...');
console.log('URL:', url.replace(/key=[^&]+/, 'key=***'));
console.log('Request body:', JSON.stringify(requestBody, null, 2));

fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'OneMinuteMenu/1.0'
  },
  body: JSON.stringify(requestBody)
})
.then(response => {
  console.log('Response status:', response.status);
  console.log('Response headers:', Object.fromEntries(response.headers.entries()));
  return response.json();
})
.then(data => {
  console.log('Response body:', JSON.stringify(data, null, 2));
})
.catch(error => {
  console.error('Error:', error);
});
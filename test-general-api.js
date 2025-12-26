async function testGeneralAPI() {
  console.log('Testing General Image Generator API...');
  
  const testData = {
    prompt: 'A simple red apple on a white background',
    aspectRatio: '1:1',
    numberOfImages: 1
  };
  
  try {
    const response = await fetch('http://localhost:3001/api/admin/generate-general-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: This won't work without proper auth, but we can see the error
      },
      body: JSON.stringify(testData)
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response body:', result);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testGeneralAPI();
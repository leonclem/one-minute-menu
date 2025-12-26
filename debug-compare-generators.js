// Simple comparison test to see the difference between working and non-working generators
console.log('Comparing generator configurations...');

// Working generator parameters (from gemini-image-generator)
const workingParams = {
  prompt: 'A simple red apple',
  negative_prompt: '',
  aspect_ratio: '1:1',
  number_of_images: 1,
  safety_filter_level: 'block_some',
  person_generation: 'dont_allow',
  reference_images: undefined,
  reference_mode: undefined,
};

// Our generator parameters
const ourParams = {
  prompt: 'A simple red apple',
  negative_prompt: '',
  aspect_ratio: '1:1',
  number_of_images: 1,
  safety_filter_level: 'block_some',
  person_generation: 'dont_allow',
};

console.log('Working generator params:', JSON.stringify(workingParams, null, 2));
console.log('Our generator params:', JSON.stringify(ourParams, null, 2));

// Check for differences
const workingKeys = Object.keys(workingParams);
const ourKeys = Object.keys(ourParams);

console.log('\nKey differences:');
console.log('Working has but ours doesn\'t:', workingKeys.filter(k => !ourKeys.includes(k)));
console.log('Ours has but working doesn\'t:', ourKeys.filter(k => !workingKeys.includes(k)));

console.log('\nValue differences:');
for (const key of workingKeys) {
  if (ourParams[key] !== workingParams[key]) {
    console.log(`${key}: working="${workingParams[key]}" vs ours="${ourParams[key]}"`);
  }
}
// Simple test for prompt construction - run with: node test-prompt-simple.js
// This creates the service manually to test the functionality

// Simple implementation to test the concept
class SimplePromptService {
  buildPrompt(item, params = {}) {
    const style = params.style || 'modern'
    const templates = {
      modern: 'Professional food photography of {name}, {description}, clean modern presentation',
      rustic: 'Rustic food photography of {name}, {description}, homestyle presentation',
      elegant: 'Fine dining photography of {name}, {description}, elegant restaurant presentation',
      casual: 'Casual food photography of {name}, {description}, approachable presentation'
    }
    
    let prompt = templates[style] || templates.modern
    prompt = prompt.replace('{name}', item.name)
    prompt = prompt.replace('{description}', item.description || '')
    
    // Add style modifiers
    const modifiers = []
    if (params.presentation === 'white_plate') modifiers.push('served on a clean white plate')
    if (params.presentation === 'wooden_board') modifiers.push('presented on a rustic wooden board')
    if (params.lighting === 'natural') modifiers.push('natural daylight')
    if (params.lighting === 'warm') modifiers.push('warm golden lighting')
    
    if (modifiers.length > 0) {
      prompt += ', ' + modifiers.join(', ')
    }
    
    prompt += ', high quality, professional photography, appetizing, well-lit'
    
    const negativePrompt = 'text, watermark, people, hands, blurry, low quality, unappetizing'
    
    return {
      prompt: prompt.trim(),
      negativePrompt,
      tokens: Math.ceil(prompt.length / 4),
      truncated: false,
      appliedTemplate: style
    }
  }
  
  validatePrompt(prompt) {
    const warnings = []
    const suggestions = []
    let quality = 'medium'
    
    if (prompt.length < 20) {
      warnings.push('Prompt is very short')
      suggestions.push('Add more descriptive details')
      quality = 'low'
    }
    
    if (prompt.includes('delicious') || prompt.includes('amazing')) {
      warnings.push('Contains vague terms')
      suggestions.push('Use specific visual details instead')
    }
    
    if (prompt.includes('golden') || prompt.includes('crispy') || prompt.includes('fresh')) {
      quality = 'high'
    }
    
    return {
      valid: warnings.length === 0,
      warnings,
      suggestions,
      estimatedQuality: quality
    }
  }
}

function validateMenuItem(item) {
  const issues = []
  const suggestions = []
  
  if (!item.name || item.name.trim().length === 0) {
    issues.push('Item name is required')
    return { suitable: false, issues, suggestions }
  }
  
  if (item.name.length < 3) {
    issues.push('Item name is too short')
    suggestions.push('Use a more descriptive name')
  }
  
  if (!item.description) {
    suggestions.push('Add a description to improve image quality')
  } else if (item.description.length < 10) {
    suggestions.push('Description is quite short - consider adding more details')
  }
  
  return {
    suitable: issues.length === 0,
    issues,
    suggestions
  }
}

// Test the service
console.log('🎨 Testing Prompt Construction Service...\n')

const service = new SimplePromptService()

// Sample menu items
const menuItems = [
  {
    name: 'Grilled Salmon',
    description: 'Fresh Atlantic salmon with quinoa, roasted vegetables, and lemon herb butter',
    price: 24.99
  },
  {
    name: 'Margherita Pizza', 
    description: 'Wood-fired pizza with fresh mozzarella, basil, and San Marzano tomatoes',
    price: 16.99
  },
  {
    name: 'Caesar Salad',
    description: undefined,
    price: 12.99
  }
]

// Test different styles
console.log('📋 Testing Different Styles:\n')
const testItem = menuItems[0]
const styles = ['modern', 'rustic', 'elegant', 'casual']

styles.forEach(style => {
  console.log(`🎭 ${style.toUpperCase()} STYLE:`)
  
  const result = service.buildPrompt(testItem, {
    style: style,
    presentation: 'white_plate',
    lighting: 'natural'
  })
  
  console.log(`✨ Prompt: "${result.prompt}"`)
  console.log(`🚫 Negative: "${result.negativePrompt}"`)
  console.log(`📊 Tokens: ${result.tokens}, Template: ${result.appliedTemplate}`)
  console.log()
})

// Test validation
console.log('🔍 Testing Prompt Validation:\n')
const testPrompts = [
  'Salmon',
  'Delicious amazing food',
  'Golden brown grilled salmon with fresh herbs and crispy vegetables'
]

testPrompts.forEach((prompt, index) => {
  console.log(`📝 Test Prompt ${index + 1}: "${prompt}"`)
  const validation = service.validatePrompt(prompt)
  
  console.log(`   ✅ Valid: ${validation.valid}`)
  console.log(`   📊 Quality: ${validation.estimatedQuality}`)
  if (validation.warnings.length > 0) {
    console.log(`   ⚠️  Warnings: ${validation.warnings.join(', ')}`)
  }
  if (validation.suggestions.length > 0) {
    console.log(`   💡 Suggestions: ${validation.suggestions.join(', ')}`)
  }
  console.log()
})

// Test menu item validation
console.log('🍽️  Testing Menu Item Validation:\n')
menuItems.forEach((item, index) => {
  console.log(`🍴 Item ${index + 1}: "${item.name}"`)
  const validation = validateMenuItem(item)
  
  console.log(`   ✅ Suitable: ${validation.suitable}`)
  if (validation.issues.length > 0) {
    console.log(`   ❌ Issues: ${validation.issues.join(', ')}`)
  }
  if (validation.suggestions.length > 0) {
    console.log(`   💡 Suggestions: ${validation.suggestions.join(', ')}`)
  }
  console.log()
})

// Test advanced features
console.log('🚀 Advanced Pizza Example:\n')
const pizzaResult = service.buildPrompt(menuItems[1], {
  style: 'rustic',
  presentation: 'wooden_board',
  lighting: 'warm'
})

console.log('🍕 Rustic Pizza Prompt:')
console.log(`✨ "${pizzaResult.prompt}"`)
console.log(`🚫 "${pizzaResult.negativePrompt}"`)

console.log('\n🎉 Prompt construction demo completed!')
console.log('\n💡 This demonstrates how menu items get transformed into AI image generation prompts!')
console.log('   The actual TypeScript service has many more features like:')
console.log('   - More sophisticated templates and modifiers')
console.log('   - Intelligent prompt truncation')
console.log('   - Advanced validation and suggestions')
console.log('   - Custom prompt additions and negative prompts')
console.log('   - Template management and style presets')
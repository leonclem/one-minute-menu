// Test script for Prompt Construction Service
// Run with: npx ts-node test-prompt-construction.js

const { 
  getPromptConstructionService, 
  createBasicPrompt, 
  validateMenuItemForImageGeneration 
} = require('./src/lib/prompt-construction.ts')

function testPromptConstruction() {
  try
    
    console.log('🎨 Testing Prompt Construction Service...\n')
    
    const service = getPromptConstructionService()
    
    // Sample menu items to test with
    const menuItems = [
      {
        id: '1',
        name: 'Grilled Salmon',
        description: 'Fresh Atlantic salmon with quinoa, roasted vegetables, and lemon herb butter',
        price: 24.99,
        available: true,
        category: 'Main Course',
        order: 0,
        imageSource: 'none'
      },
      {
        id: '2', 
        name: 'Margherita Pizza',
        description: 'Wood-fired pizza with fresh mozzarella, basil, and San Marzano tomatoes',
        price: 16.99,
        available: true,
        category: 'Pizza',
        order: 1,
        imageSource: 'none'
      },
      {
        id: '3',
        name: 'Chocolate Lava Cake',
        description: 'Warm chocolate cake with molten center, vanilla ice cream, and berry compote',
        price: 8.99,
        available: true,
        category: 'Desserts',
        order: 2,
        imageSource: 'none'
      },
      {
        id: '4',
        name: 'Caesar Salad',
        description: undefined, // Test with no description
        price: 12.99,
        available: true,
        category: 'Salads',
        order: 3,
        imageSource: 'none'
      }
    ]
    
    // Test different styles
    const styles = ['modern', 'rustic', 'elegant', 'casual']
    
    console.log('📋 Testing Different Styles:\n')
    
    const testItem = menuItems[0] // Grilled Salmon
    
    styles.forEach(style => {
      console.log(`🎭 ${style.toUpperCase()} STYLE:`)
      
      const result = service.buildPrompt(testItem, {
        style: style,
        presentation: 'white_plate',
        lighting: 'natural'
      })
      
      console.log(`✨ Prompt: "${result.prompt}"`)
      console.log(`🚫 Negative: "${result.negativePrompt}"`)
      console.log(`📊 Tokens: ${result.tokens}, Truncated: ${result.truncated}`)
      console.log(`📈 Template: ${result.appliedTemplate}`)
      console.log()
    })
    
    console.log('🔍 Testing Prompt Validation:\n')
    
    // Test validation with different prompt qualities
    const testPrompts = [
      'Salmon', // Short/bad
      'Delicious amazing food that tastes great', // Vague
      'Golden brown grilled salmon with fresh herbs and colorful roasted vegetables, professional food photography' // Good
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
    
    console.log('🍽️  Testing Menu Item Validation:\n')
    
    menuItems.forEach((item, index) => {
      console.log(`🍴 Item ${index + 1}: "${item.name}"`)
      const validation = validateMenuItemForImageGeneration(item)
      
      console.log(`   ✅ Suitable: ${validation.suitable}`)
      if (validation.issues.length > 0) {
        console.log(`   ❌ Issues: ${validation.issues.join(', ')}`)
      }
      if (validation.suggestions.length > 0) {
        console.log(`   💡 Suggestions: ${validation.suggestions.join(', ')}`)
      }
      console.log()
    })
    
    console.log('🚀 Testing Advanced Features:\n')
    
    // Test with custom parameters
    const advancedResult = service.buildPrompt(menuItems[1], { // Pizza
      style: 'rustic',
      presentation: 'wooden_board',
      lighting: 'warm',
      customPromptAdditions: 'garnished with fresh basil leaves, drizzled with olive oil',
      negativePrompt: 'no people, no hands, no utensils being used'
    })
    
    console.log('🍕 Advanced Pizza Prompt:')
    console.log(`✨ Prompt: "${advancedResult.prompt}"`)
    console.log(`🚫 Negative: "${advancedResult.negativePrompt}"`)
    console.log()
    
    // Test suggestions
    const suggestions = service.suggestImprovements('Basic pasta dish')
    console.log('💡 Improvement Suggestions for "Basic pasta dish":')
    suggestions.forEach(suggestion => {
      console.log(`   ${suggestion.type}: ${suggestion.message}`)
      if (suggestion.example) {
        console.log(`   Example: ${suggestion.example}`)
      }
    })
    console.log()
    
    // Test all available templates
    console.log('📚 Available Templates:')
    const templates = service.getAllTemplates()
    templates.forEach(template => {
      console.log(`   ${template.id}: ${template.name} - ${template.basePrompt}`)
    })
    console.log()
    
    // Test basic prompt helper
    console.log('⚡ Quick Basic Prompts:')
    menuItems.slice(0, 2).forEach(item => {
      const basicPrompt = createBasicPrompt(item, 'elegant')
      console.log(`   ${item.name}: "${basicPrompt}"`)
    })
    
    console.log('\n🎉 All prompt construction tests completed successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('Stack:', error.stack)
    process.exit(1)
  }
}

// Run the test
testPromptConstruction()
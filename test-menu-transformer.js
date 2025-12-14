// Test script to verify the menu transformer fix
// Run this in Node.js or browser console

// Mock menu data that might be causing issues
const problematicMenu = {
  id: 'test-menu',
  name: 'Test Menu',
  items: [
    {
      id: 'item-1',
      name: 'Burger',
      price: 12.99,
      category: 'Main Dishes',
      description: 'Delicious burger',
      imageSource: 'none'
    },
    {
      id: 'item-2', 
      name: 'Fries',
      price: 4.99,
      category: 'Sides',
      description: 'Crispy fries',
      imageSource: 'none'
    }
  ],
  categories: [
    {
      id: 'cat-1',
      name: 'Main Dishes',
      items: [], // Empty items array - this might be the issue
      order: 0
    }
  ],
  theme: {
    layout: {
      currency: '$'
    }
  }
};

console.log('Testing menu transformer with problematic data...');
console.log('Input menu:', problematicMenu);

// This would be the toEngineMenu call that's failing
// The fix should handle the case where categories exist but have empty items arrays
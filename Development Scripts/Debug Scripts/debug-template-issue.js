// Debug script to test template compatibility
// Run this in the browser console on the template page to see what's failing

console.log('=== DEBUGGING TEMPLATE ISSUE ===');

// Check if we can access the menu data
const menuId = window.location.pathname.split('/')[3];
console.log('Menu ID:', menuId);

// Test the API calls that the template page makes
async function debugTemplateIssue() {
  try {
    console.log('1. Testing menu data fetch...');
    const menuResp = await fetch(`/api/menus/${menuId}`);
    const menuData = await menuResp.json();
    console.log('Menu data:', menuData);
    
    if (!menuResp.ok) {
      console.error('❌ Menu fetch failed:', menuData);
      return;
    }
    
    const menu = menuData.data;
    console.log('Menu structure:', {
      id: menu.id,
      name: menu.name,
      itemsCount: menu.items?.length || 0,
      categoriesCount: menu.categories?.length || 0,
      hasExtractionMetadata: !!menu.extractionMetadata,
      items: menu.items?.slice(0, 3).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category
      })),
      categories: menu.categories?.slice(0, 2).map(cat => ({
        id: cat.id,
        name: cat.name,
        itemsCount: cat.items?.length || 0
      }))
    });
    
    console.log('2. Testing templates available API...');
    const templatesResp = await fetch(`/api/templates/available?menuId=${menuId}`);
    const templatesData = await templatesResp.json();
    
    if (!templatesResp.ok) {
      console.error('❌ Templates fetch failed:', templatesData);
      return;
    }
    
    console.log('Templates response:', templatesData);
    
    console.log('3. Testing layout generation...');
    if (templatesData.data && templatesData.data.length > 0) {
      const firstTemplate = templatesData.data[0];
      console.log('Testing with template:', firstTemplate.template.id);
      
      const layoutResp = await fetch(`/api/menus/${menuId}/layout?templateId=${firstTemplate.template.id}`);
      const layoutData = await layoutResp.json();
      
      if (!layoutResp.ok) {
        console.error('❌ Layout generation failed:', layoutData);
      } else {
        console.log('✅ Layout generated successfully:', layoutData);
      }
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugTemplateIssue();
// Enhanced debug script to check menu data at each step
// Run this in the browser console on the template page

console.log('=== ENHANCED MENU DATA DEBUG ===');

const menuId = window.location.pathname.split('/')[3];
console.log('Menu ID:', menuId);

async function debugMenuData() {
  try {
    console.log('🔍 Step 1: Fetching raw menu data from API...');
    const menuResp = await fetch(`/api/menus/${menuId}`);
    const menuData = await menuResp.json();
    
    if (!menuResp.ok) {
      console.error('❌ Menu fetch failed:', menuData);
      return;
    }
    
    const menu = menuData.data;
    console.log('📊 Raw menu data structure:', {
      id: menu.id,
      name: menu.name,
      itemsCount: menu.items?.length || 0,
      categoriesCount: menu.categories?.length || 0,
      hasExtractionMetadata: !!menu.extractionMetadata
    });
    
    console.log('📋 Items array (first 5):', menu.items?.slice(0, 5).map(item => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: item.price,
      imageSource: item.imageSource
    })));
    
    console.log('📂 Categories array:', menu.categories?.map(cat => ({
      id: cat.id,
      name: cat.name,
      itemsCount: cat.items?.length || 0,
      items: cat.items?.slice(0, 3).map(item => ({
        id: item.id,
        name: item.name,
        category: item.category
      }))
    })));
    
    console.log('🔍 Step 2: Testing templates available API...');
    const templatesResp = await fetch(`/api/templates/available?menuId=${menuId}`);
    const templatesData = await templatesResp.json();
    
    if (!templatesResp.ok) {
      console.error('❌ Templates fetch failed:', templatesData);
      console.log('Response status:', templatesResp.status);
      console.log('Response headers:', Object.fromEntries(templatesResp.headers.entries()));
      return;
    }
    
    console.log('✅ Templates response:', templatesData);
    
    if (templatesData.data && templatesData.data.length > 0) {
      console.log('🔍 Step 3: Testing layout generation...');
      const firstTemplate = templatesData.data[0];
      console.log('Using template:', firstTemplate.template.id);
      
      const layoutResp = await fetch(`/api/menus/${menuId}/layout?templateId=${firstTemplate.template.id}`);
      const layoutData = await layoutResp.json();
      
      if (!layoutResp.ok) {
        console.error('❌ Layout generation failed:', layoutData);
        console.log('Response status:', layoutResp.status);
      } else {
        console.log('✅ Layout generated successfully');
        console.log('Layout data structure:', {
          hasLayout: !!layoutData.data,
          sectionsCount: layoutData.data?.sections?.length || 0,
          totalTiles: layoutData.data?.tiles?.length || 0
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Debug script error:', error);
  }
}

debugMenuData();
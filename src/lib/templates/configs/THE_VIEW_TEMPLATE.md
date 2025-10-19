# "The View" Template Documentation

## Overview

"The View" is a clean, modern menu template designed for upscale restaurants and cafes. It features elegant typography, clear hierarchy, and support for all menu data fields including dietary tags, allergens, and variants.

## Template Specifications

- **Template ID**: `the-view`
- **Version**: 1.0.0
- **Format**: A4 Portrait
- **Author**: QR Menu System
- **Premium**: No (free template)

## Design Features

### Typography
- **Restaurant Name**: Playfair Display, 36px, Bold
- **Category Names**: Playfair Display, 24px, Semi-bold
- **Item Names**: Inter, 16px, Semi-bold
- **Item Prices**: Inter, 16px, Semi-bold
- **Descriptions**: Inter, 14px, Regular
- **Dietary Tags**: Inter, 12px, Medium
- **Allergens**: Inter, 12px, Regular

### Color Scheme
- **Primary Text**: #1a1a1a (Dark)
- **Secondary Text**: #666666 (Medium Gray)
- **Accent**: #d4af37 (Gold)
- **Background**: #ffffff (White)
- **Dividers**: #e0e0e0 (Light Gray)
- **Dietary Tags**: #2d5016 (Green) on #f0f0f0 (Light Gray)
- **Allergens**: #c41e3a (Red)

### Layout
- **Page Padding**: 48px all sides
- **Item Spacing**: 24px between items
- **Category Spacing**: 48px between categories
- **Item Structure**:
  - Top row: Item name (left) + Icon (if present) | Price (right)
  - Second row: Description (full width)
  - Third row: Dietary tags and allergens (if present)
  - Fourth row: Variants (if present)

## Data Bindings

### Required Bindings
- `{{restaurant.name}}` → RestaurantName layer
- `{{category.name}}` → CategoryName layer
- `{{category.items}}` → ItemsContainer layer
- `{{item.name}}` → ItemName layer

### Optional Bindings
- `{{item.price}}` → ItemPrice layer
- `{{item.description}}` → ItemDescription layer
- `{{item.image_icon}}` → ItemIcon layer
- `{{item.dietaryTags}}` → DietaryTags layer
- `{{item.allergens}}` → Allergens layer
- `{{item.variants}}` → VariantsContainer layer

### Conditional Rendering
All optional bindings have conditional rendering rules:
- Show layer only if data is present
- Hide layer if data is missing or empty

## Customization Options

### Customizable Colors
- Primary text color
- Accent color
- Category divider color

### Customizable Fonts
- Restaurant name font
- Category name font
- Item name font

### Price Display Modes
- Currency symbol mode: "$12.50"
- Amount-only mode: "12.50"

## Usage

### 1. Register the Template

```typescript
import { registerTheViewTemplate } from '@/lib/templates/configs/register-the-view'

await registerTheViewTemplate()
```

Or use the CLI script:

```bash
npx tsx scripts/register-the-view-template.ts
```

### 2. Load the Template

```typescript
import { templateRegistry } from '@/lib/templates/registry'

const template = await templateRegistry.loadTemplate('the-view')
```

### 3. Bind Menu Data

```typescript
import { BindingEngine } from '@/lib/templates/binding-engine'

const bindingEngine = new BindingEngine()

const boundData = bindingEngine.bind({
  menu: {
    restaurantName: 'The View Restaurant',
    categories: menuCategories, // CategoryV2[]
  },
  template,
  customization: {
    colors: {
      primary: '#1a1a1a',
      accent: '#d4af37',
    },
    priceDisplayMode: 'symbol',
  },
})
```

### 4. Render the Menu

```typescript
import { RenderEngine } from '@/lib/render/engine'

const renderEngine = new RenderEngine()

const renderResult = await renderEngine.render(boundData, template, {
  format: 'html',
  quality: 'standard',
  includeStyles: true,
  embedFonts: true,
})
```

### 5. Export to PDF/PNG

```typescript
import { ExportService } from '@/lib/render/export-service'

const exportService = new ExportService()

const exportResult = await exportService.exportToPDF(renderResult, {
  format: 'pdf',
  filename: 'menu-the-view.pdf',
  pageSize: 'A4',
  dpi: 300,
})
```

## Supported Menu Features

### ✅ Fully Supported
- Restaurant name
- Category names and sections
- Item names
- Item prices (with currency formatting)
- Item descriptions
- Item icons/images
- Dietary tags (vegetarian, vegan, gluten-free, etc.)
- Allergen warnings
- Item variants with prices
- Multiple categories
- Nested subcategories

### ⚠️ Partially Supported
- Very long descriptions (may wrap or truncate)
- Large number of variants (may affect layout)

### ❌ Not Supported
- Custom item images (only icons)
- Multi-column layouts
- Custom page breaks (uses automatic pagination)

## Print Optimization

The template includes print-specific optimizations:
- `page-break-inside: avoid` on items and categories
- Category headers kept with at least one item
- Controlled page breaks for long items
- Print-safe margins and spacing

## Best Practices

### Menu Data
- Keep item names concise (under 50 characters)
- Keep descriptions under 150 characters for best layout
- Use high-quality icons (square format, at least 200x200px)
- Limit variants to 5 or fewer per item

### Customization
- Use high-contrast colors for text
- Test print output before finalizing colors
- Stick to web-safe fonts for best compatibility

### Performance
- Template loads in < 500ms
- Binding completes in < 100ms for 100 items
- Rendering completes in < 2s for full menu
- PDF export completes in < 5s

## Troubleshooting

### Template Not Found
- Ensure template is registered: `npx tsx scripts/register-the-view-template.ts`
- Check database connection
- Verify template ID is correct: `the-view`

### Missing Images
- Upload preview images to Supabase Storage
- Check image URLs in template metadata
- Verify storage bucket permissions

### Layout Issues
- Verify menu data structure matches CategoryV2/MenuItemV2 schema
- Check for very long text that may overflow
- Test with different menu sizes

### Export Failures
- Ensure Playwright is installed: `npm install playwright`
- Check browser installation: `npx playwright install chromium`
- Verify sufficient memory for large menus

## Version History

### 1.0.0 (2024-01-18)
- Initial release
- Support for all core menu features
- Customizable colors and fonts
- Print optimization
- A4 portrait format

## Future Enhancements

Planned for future versions:
- Landscape orientation option
- Multi-column layout variant
- Additional color schemes
- More font options
- Custom page break controls
- Image gallery support


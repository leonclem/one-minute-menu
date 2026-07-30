# Textured Backgrounds Feature

## Overview

The layout-lab now supports textured backgrounds for enhanced visual appeal. This feature integrates paper-like textures with color palettes to create more sophisticated and elegant menu designs.

## Supported Palettes

### Midnight Gold
- **Base Color**: Dark charcoal (#1A1A1A)
- **Texture**: `dark-paper-2.png` with subtle gold overlay
- **Effect**: Combines the rich, dark background with a subtle gold gradient and paper texture
- **Best For**: Upscale restaurants, wine bars, fine dining establishments

### Elegant Dark
- **Base Color**: Deep navy (#0b0d11) 
- **Texture**: `dark-paper.png`
- **Effect**: Clean dark background with subtle paper texture
- **Best For**: Modern restaurants, cocktail bars, contemporary dining

## How to Use

### In Layout Lab
1. Navigate to `/dev/layout-lab` (requires admin access)
2. Select a fixture menu (try "Medium" for best results)
3. Choose "Classic Cards V2" template
4. Select either "Midnight Gold" or "Elegant Dark" palette
5. Enable "Textured backgrounds" in Display Options
6. Click "Generate Layout" to see the textured background

### In Code
The texture system works at multiple levels:

#### 1. Client-Side (Fast Preview)
```typescript
// Static URL reference for immediate preview
backgroundImage: `
  linear-gradient(135deg, rgba(212, 175, 55, 0.03) 0%, transparent 50%, rgba(212, 175, 55, 0.02) 100%),
  url('/textures/dark-paper-2.png')
`
```

#### 2. Server-Side (PDF Export)
```typescript
// Base64 embedded for PDF compatibility
const textureDataURL = await getTextureDataURL('dark-paper-2.png', headers)
backgroundImage: `url('${textureDataURL}')`
```

## Technical Implementation

### Files Modified
- `src/lib/templates/export/texture-utils.ts` - Added `getMidnightGoldBackground()`
- `src/lib/templates/server-style-generator.ts` - Added server-side texture support
- `src/lib/templates/style-generator.ts` - Added client-side texture support
- `src/lib/templates/v2/renderer-web-v2.tsx` - Added web preview texture support
- `src/app/dev/layout-lab/` - Added texture toggle controls

### Texture Assets
- `public/textures/dark-paper.png` - Elegant Dark texture
- `public/textures/dark-paper-2.png` - Midnight Gold texture

### Color Palette Integration
The texture system automatically detects compatible palettes:
- `midnight-gold` → Uses `dark-paper-2.png` with gold overlay
- `elegant-dark` → Uses `dark-paper.png` with subtle effects

## Design Principles

### Subtle Enhancement
Textures are designed to enhance, not overpower:
- Low opacity overlays (2-4%)
- Subtle blend modes
- Maintains text readability

### Performance Optimized
- Static URLs for web preview (fast loading)
- Base64 embedding for PDF export (compatibility)
- Graceful fallbacks if textures fail to load

### Accessibility Compliant
- Maintains WCAG contrast ratios
- Textures don't interfere with text legibility
- Fallback CSS patterns if images unavailable

## Future Enhancements

### Additional Textures
- Linen texture for warm, rustic themes
- Marble texture for luxury establishments
- Wood grain for casual dining

### Dynamic Texture Selection
- User-uploadable textures
- Texture intensity controls
- Seasonal texture variations

### Advanced Blending
- Multiple texture layers
- Animated subtle effects
- Responsive texture scaling

## Testing

To test the feature:
1. Set `paletteId: 'midnight-gold'` and `texturesEnabled: true`
2. Verify texture loads in web preview
3. Test PDF export includes embedded texture
4. Confirm fallback works when texture unavailable

## Browser Support

- **Modern Browsers**: Full support with CSS blend modes
- **Older Browsers**: Graceful degradation to solid colors
- **PDF Export**: Universal support via base64 embedding
# "The View" Template Assets

This directory contains the preview and thumbnail images for "The View" template.

## Required Files

- `preview.png` - Full preview image of the template (recommended: 1200x1600px)
- `thumbnail.png` - Thumbnail image for template selection (recommended: 400x533px)

## Image Guidelines

### Preview Image (preview.png)
- **Dimensions**: 1200x1600px (A4 portrait aspect ratio)
- **Format**: PNG with transparency support
- **Content**: Full page view of a sample menu rendered with "The View" template
- **Purpose**: Shown in template detail view and preview modal

### Thumbnail Image (thumbnail.png)
- **Dimensions**: 400x533px (A4 portrait aspect ratio, scaled down)
- **Format**: PNG with transparency support
- **Content**: Scaled-down version of the preview image
- **Purpose**: Shown in template selection grid

## Creating the Images

### Option 1: Generate from Figma
1. Open the Figma file for "The View" template
2. Export the frame as PNG at 2x resolution
3. Resize to the required dimensions
4. Save as `preview.png` and `thumbnail.png`

### Option 2: Generate from Rendered Menu
1. Use the template system to render a sample menu
2. Export as PNG at high resolution
3. Crop and resize to the required dimensions
4. Save as `preview.png` and `thumbnail.png`

### Option 3: Create Placeholder Images
For development/testing, you can create simple placeholder images:

```bash
# Using ImageMagick (if installed)
convert -size 1200x1600 xc:white -pointsize 72 -fill black -gravity center -annotate +0+0 "The View\nTemplate\nPreview" preview.png
convert -size 400x533 xc:white -pointsize 24 -fill black -gravity center -annotate +0+0 "The View\nTemplate" thumbnail.png
```

## Uploading to Supabase Storage

Once the images are created, they should be uploaded to Supabase Storage:

### Using Supabase Dashboard
1. Go to Storage in Supabase Dashboard
2. Navigate to the `templates` bucket (create if it doesn't exist)
3. Create folder: `the-view`
4. Upload `preview.png` and `thumbnail.png` to `templates/the-view/`

### Using Supabase CLI
```bash
supabase storage upload templates/the-view/preview.png ./public/templates/the-view/preview.png
supabase storage upload templates/the-view/thumbnail.png ./public/templates/the-view/thumbnail.png
```

### Using API
```typescript
import { createServerSupabaseClient } from '@/lib/supabase-server'

const supabase = createServerSupabaseClient()

// Upload preview
const previewFile = await fs.readFile('./public/templates/the-view/preview.png')
await supabase.storage
  .from('templates')
  .upload('the-view/preview.png', previewFile, {
    contentType: 'image/png',
    upsert: true
  })

// Upload thumbnail
const thumbnailFile = await fs.readFile('./public/templates/the-view/thumbnail.png')
await supabase.storage
  .from('templates')
  .upload('the-view/thumbnail.png', thumbnailFile, {
    contentType: 'image/png',
    upsert: true
  })
```

## Current Status

⚠️ **Placeholder images needed** - The template configuration references these image paths, but the actual images need to be created and uploaded.

For now, the template will work but may show broken image links in the UI until the images are provided.


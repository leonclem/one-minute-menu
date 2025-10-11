# Image Compositor

The Image Compositor module provides functionality for compositing text layers over AI-generated backgrounds while maintaining text crispness and quality.

## Overview

The compositor uses the Sharp library to blend two image layers:
- **Background Layer**: AI-generated background from nano-banana
- **Text Layer**: Deterministically rendered menu text as PNG with transparency

This approach ensures that menu text is always pixel-perfect and readable, while the background provides visual appeal.

## Features

- **Multiple Blend Modes**: Support for normal, multiply, and overlay blending
- **Automatic Dimension Matching**: Resizes text layer to match background if needed
- **High Quality Output**: PNG output at 100% quality to preserve text crispness
- **Error Handling**: Comprehensive validation and error messages
- **Metadata Support**: Optional metadata output for debugging and logging

## Usage

### Basic Example

```typescript
import { ImageCompositor } from '@/lib/render';

const compositor = new ImageCompositor();

const result = await compositor.composite({
  textLayer: textLayerBuffer,      // PNG with transparency
  backgroundLayer: backgroundBuffer, // AI-generated background
  blend: 'normal',                  // 'normal' | 'multiply' | 'overlay'
});

// result is a Buffer containing the composited PNG
```

### Convenience Function

```typescript
import { compositeImages } from '@/lib/render';

const result = await compositeImages({
  textLayer: textLayerBuffer,
  backgroundLayer: backgroundBuffer,
  blend: 'normal',
});
```

### With Metadata

```typescript
const result = await compositor.compositeWithMetadata({
  textLayer: textLayerBuffer,
  backgroundLayer: backgroundBuffer,
  blend: 'normal',
});

console.log(result.metadata); // { width, height, format }
```

## Blend Modes

### Normal (Recommended)
The default blend mode. Text layer is placed directly over the background with full opacity. This is the recommended mode for menu text as it ensures maximum readability.

```typescript
blend: 'normal'
```

### Multiply
Darkens the background where text appears. Useful for creating subtle text effects, but may reduce readability.

```typescript
blend: 'multiply'
```

### Overlay
Creates a more dramatic effect by preserving highlights and shadows. Use with caution as it can affect text readability.

```typescript
blend: 'overlay'
```

## Integration with Menu Export Pipeline

The compositor fits into the menu export workflow as follows:

1. **Generate Background**: Use nano-banana to generate AI background
2. **Render Text**: Use MenuRenderer + MenuExporter to render text as PNG
3. **Composite**: Use ImageCompositor to layer text over background
4. **Export**: Save or convert to final format (PDF/PNG)

```typescript
// 1. Generate background
const backgroundUrl = await backgroundGenerator.generateBackground({
  templateId: 'kraft-sports',
  brandColors: ['#8B4513', '#F5DEB3'],
});
const backgroundBuffer = await fetch(backgroundUrl).then(r => r.arrayBuffer());

// 2. Render text layer
const textLayerBuffer = await menuExporter.export(html, {
  format: 'png',
  dpi: 300,
  size: 'A4',
});

// 3. Composite
const compositor = new ImageCompositor();
const finalMenu = await compositor.composite({
  textLayer: Buffer.from(textLayerBuffer),
  backgroundLayer: Buffer.from(backgroundBuffer),
  blend: 'normal',
});

// 4. Save or convert
await fs.writeFile('menu.png', finalMenu);
```

## Error Handling

The compositor throws errors for:
- Invalid image buffers
- Corrupted image data
- Unsupported image formats

Always wrap compositor calls in try-catch:

```typescript
try {
  const result = await compositor.composite(options);
  // Success
} catch (error) {
  console.error('Compositing failed:', error);
  // Fall back to text-only export
}
```

## Performance Considerations

- **Image Size**: Larger images (A4 at 300 DPI = 2480x3508) take longer to process
- **Blend Modes**: Normal blend is fastest; multiply and overlay are slightly slower
- **Memory**: Sharp is memory-efficient but large images still require significant RAM
- **Caching**: Consider caching composited results for frequently accessed menus

## Testing

The compositor includes comprehensive unit tests covering:
- All blend modes
- Dimension mismatches
- Error cases
- Edge cases (very small/large images)
- Quality preservation

Run tests with:
```bash
npm test -- compositor.test.ts
```

## Requirements Satisfied

This module satisfies the following requirements:
- **5.5**: Layer deterministic text rendering over AI-generated backgrounds
- **3.1**: Integration with nano-banana generated backgrounds
- **8.1, 8.2**: Support for PDF/PNG export pipeline

## API Reference

### `ImageCompositor`

Main class for compositing operations.

#### Methods

##### `composite(options: CompositeOptions): Promise<Buffer>`
Composites text layer over background and returns PNG buffer.

##### `compositeWithMetadata(options: CompositeOptions): Promise<CompositeResult>`
Composites and returns buffer with metadata.

### `compositeImages(options: CompositeOptions): Promise<Buffer>`
Convenience function for one-off compositing.

### Types

```typescript
interface CompositeOptions {
  textLayer: Buffer;
  backgroundLayer: Buffer;
  blend: 'normal' | 'multiply' | 'overlay';
}

interface CompositeResult {
  buffer: Buffer;
  metadata: {
    width: number;
    height: number;
    format: string;
  };
}
```

## See Also

- [MenuRenderer](./renderer.ts) - Renders menu HTML/CSS
- [MenuExporter](./exporter.ts) - Exports to PDF/PNG
- [BackgroundGenerator](../templates/background-generator.ts) - Generates AI backgrounds
- [Sharp Documentation](https://sharp.pixelplumbing.com/) - Image processing library

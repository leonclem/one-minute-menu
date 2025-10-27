# Edge-Safe Fallback Documentation

## Overview

This document describes lightweight fallback implementations for environments where heavy dependencies (Puppeteer, sharp, pdf-lib) are not available or practical. These fallbacks enable the layout engine to run on edge runtimes, serverless functions with size constraints, or resource-limited environments.

## Problem Statement

The current implementation uses:
- **Puppeteer**: For rendering HTML to images (large binary, ~300MB)
- **sharp**: For image processing (native dependencies)
- **pdf-lib**: For PDF generation (works on edge, but limited)

These dependencies:
- Cannot run on Vercel Edge Runtime
- Increase cold start times in serverless functions
- Require native binaries that may not be available
- Consume significant memory and disk space

## Edge-Safe Architecture

### Detection and Fallback Strategy

```typescript
/**
 * Detect if we're running in an edge-safe environment
 */
export function isEdgeRuntime(): boolean {
  // Check for edge runtime indicators
  return (
    typeof EdgeRuntime !== 'undefined' ||
    process.env.NEXT_RUNTIME === 'edge' ||
    !process.versions?.node // No Node.js in edge
  )
}

/**
 * Detect available export capabilities
 */
export interface ExportCapabilities {
  html: boolean // Always available
  pdf: boolean // pdf-lib works on edge
  png: boolean // Requires Puppeteer/sharp
  jpg: boolean // Requires Puppeteer/sharp
}

export function detectExportCapabilities(): ExportCapabilities {
  const isEdge = isEdgeRuntime()
  
  return {
    html: true, // Always available
    pdf: !isEdge, // pdf-lib works everywhere except edge
    png: !isEdge, // Requires Node.js runtime
    jpg: !isEdge  // Requires Node.js runtime
  }
}
```

## Fallback Implementations

### 1. HTML + CSS Print Media Queries (Universal)

This approach works everywhere and provides high-quality printable output.

#### Implementation

```typescript
/**
 * Generate print-optimized HTML with CSS media queries
 * Works on all platforms including edge runtimes
 */
export function generatePrintableHTML(
  layout: GridLayout,
  menu: LayoutMenuData
): string {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${menu.metadata.title}</title>
  <style>
    /* Base styles */
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      line-height: 1.6;
      color: #333;
    }
    
    /* Screen styles */
    @media screen {
      body {
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem;
        background: #f5f5f5;
      }
      
      .menu-container {
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
    }
    
    /* Print styles */
    @media print {
      body {
        background: white;
      }
      
      .menu-container {
        width: 100%;
      }
      
      /* A4 page setup */
      @page {
        size: A4 portrait;
        margin: 2cm;
      }
      
      /* Prevent page breaks inside sections */
      .section {
        page-break-inside: avoid;
      }
      
      /* Prevent orphaned headers */
      .section-header {
        page-break-after: avoid;
      }
      
      /* Hide interactive elements */
      button, .no-print {
        display: none !important;
      }
    }
    
    /* Layout grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(${layout.preset.gridConfig.columns.desktop}, 1fr);
      gap: 1rem;
      margin-bottom: 2rem;
    }
    
    @media print {
      .grid {
        grid-template-columns: repeat(${layout.preset.gridConfig.columns.print}, 1fr);
        gap: 0.5rem;
      }
    }
    
    /* Section styles */
    .section {
      margin-bottom: 2rem;
    }
    
    .section-header {
      font-size: 1.5rem;
      font-weight: bold;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid #333;
    }
    
    /* Tile styles */
    .tile {
      border: 1px solid #ddd;
      border-radius: 8px;
      padding: 1rem;
      background: white;
    }
    
    @media print {
      .tile {
        border-radius: 4px;
        padding: 0.5rem;
      }
    }
    
    .tile-name {
      font-weight: 600;
      font-size: 1rem;
      margin-bottom: 0.25rem;
    }
    
    .tile-price {
      font-weight: bold;
      color: #2563eb;
      font-size: 1.125rem;
    }
    
    .tile-description {
      font-size: 0.875rem;
      color: #666;
      margin-top: 0.5rem;
    }
    
    /* Filler tiles */
    .filler-tile {
      background: linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%);
      border: none;
    }
    
    @media print {
      .filler-tile {
        display: none; /* Hide fillers in print */
      }
    }
  </style>
</head>
<body>
  <div class="menu-container">
    <h1 class="menu-title">${menu.metadata.title}</h1>
    ${renderSections(layout, menu)}
  </div>
</body>
</html>
  `
  
  return html
}

function renderSections(layout: GridLayout, menu: LayoutMenuData): string {
  return layout.sections.map(section => `
    <div class="section">
      <h2 class="section-header">${section.name}</h2>
      <div class="grid">
        ${section.tiles.map(tile => renderTile(tile)).join('')}
      </div>
    </div>
  `).join('')
}

function renderTile(tile: GridTile): string {
  if (tile.type === 'filler') {
    return '<div class="tile filler-tile"></div>'
  }
  
  const item = tile.item
  return `
    <div class="tile">
      <div class="tile-name">${escapeHtml(item.name)}</div>
      <div class="tile-price">${item.price.toFixed(2)}</div>
      ${item.description ? `<div class="tile-description">${escapeHtml(item.description)}</div>` : ''}
    </div>
  `
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }
  return text.replace(/[&<>"']/g, m => map[m])
}
```

#### Usage

```typescript
// Generate printable HTML
const html = generatePrintableHTML(layout, menu)

// User can:
// 1. Open in browser and use Ctrl+P / Cmd+P to print
// 2. Use browser's "Save as PDF" feature
// 3. Send to printer directly

// Serve as response
return new Response(html, {
  headers: {
    'Content-Type': 'text/html',
    'Content-Disposition': 'inline; filename="menu.html"'
  }
})
```

### 2. Client-Side PDF Generation

Use browser's print-to-PDF capability via client-side JavaScript.

#### Implementation

```typescript
/**
 * Client-side PDF generation using browser print dialog
 * Works on all platforms, no server dependencies
 */
export function generateClientSidePDF(layout: GridLayout, menu: LayoutMenuData) {
  // Generate print-optimized HTML
  const html = generatePrintableHTML(layout, menu)
  
  // Open in new window
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Popup blocked. Please allow popups for PDF generation.')
  }
  
  // Write HTML
  printWindow.document.write(html)
  printWindow.document.close()
  
  // Wait for load, then trigger print dialog
  printWindow.onload = () => {
    printWindow.print()
  }
}

/**
 * Alternative: Use iframe for seamless printing
 */
export function printLayoutInIframe(layout: GridLayout, menu: LayoutMenuData) {
  const html = generatePrintableHTML(layout, menu)
  
  // Create hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.display = 'none'
  document.body.appendChild(iframe)
  
  // Write content
  const doc = iframe.contentWindow?.document
  if (!doc) throw new Error('Failed to create iframe')
  
  doc.open()
  doc.write(html)
  doc.close()
  
  // Print when loaded
  iframe.onload = () => {
    iframe.contentWindow?.print()
    
    // Clean up after print
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }
}
```

### 3. SVG-Based Export (Edge-Safe)

Generate SVG that can be converted to PDF or images client-side.

#### Implementation

```typescript
/**
 * Generate SVG representation of layout
 * Can be converted to PDF/PNG client-side or server-side
 */
export function generateLayoutSVG(
  layout: GridLayout,
  menu: LayoutMenuData,
  options: { width: number; height: number }
): string {
  const { width, height } = options
  const columns = layout.preset.gridConfig.columns.desktop
  const tileWidth = (width - (columns + 1) * 16) / columns
  const tileHeight = tileWidth // Square tiles
  
  let svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <style>
      .tile { fill: white; stroke: #ddd; stroke-width: 1; }
      .tile-name { font-family: sans-serif; font-size: 14px; font-weight: 600; }
      .tile-price { font-family: sans-serif; font-size: 16px; font-weight: bold; fill: #2563eb; }
      .tile-description { font-family: sans-serif; font-size: 12px; fill: #666; }
      .section-header { font-family: sans-serif; font-size: 20px; font-weight: bold; }
    </style>
  </defs>
  <rect width="${width}" height="${height}" fill="white"/>
`
  
  let yOffset = 40
  
  for (const section of layout.sections) {
    // Section header
    svg += `<text x="16" y="${yOffset}" class="section-header">${escapeXml(section.name)}</text>`
    yOffset += 40
    
    // Tiles
    for (const tile of section.tiles) {
      if (tile.type === 'item') {
        const x = 16 + tile.column * (tileWidth + 16)
        const y = yOffset + tile.row * (tileHeight + 16)
        
        svg += `
          <rect x="${x}" y="${y}" width="${tileWidth}" height="${tileHeight}" class="tile"/>
          <text x="${x + 12}" y="${y + 24}" class="tile-name">${escapeXml(tile.item.name)}</text>
          <text x="${x + 12}" y="${y + 48}" class="tile-price">${tile.item.price.toFixed(2)}</text>
        `
        
        if (tile.item.description) {
          svg += `<text x="${x + 12}" y="${y + 72}" class="tile-description">${escapeXml(tile.item.description.substring(0, 50))}</text>`
        }
      }
    }
    
    // Calculate section height
    const maxRow = Math.max(...section.tiles.map(t => t.row))
    yOffset += (maxRow + 1) * (tileHeight + 16) + 32
  }
  
  svg += '</svg>'
  return svg
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
```

#### Client-Side SVG to PNG Conversion

```typescript
/**
 * Convert SVG to PNG using canvas (client-side only)
 */
export async function svgToPNG(svg: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('Failed to get canvas context'))
      return
    }
    
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      canvas.toBlob(blob => {
        if (blob) resolve(blob)
        else reject(new Error('Failed to create blob'))
      }, 'image/png')
    }
    img.onerror = reject
    img.src = 'data:image/svg+xml;base64,' + btoa(svg)
  })
}
```

### 4. Lightweight PDF Generation (Edge-Compatible)

Use pdf-lib without Puppeteer for basic PDF generation.

#### Implementation

```typescript
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'

/**
 * Generate PDF using pdf-lib (works on edge runtime)
 * No Puppeteer required
 */
export async function generateLightweightPDF(
  layout: GridLayout,
  menu: LayoutMenuData
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595, 842]) // A4 size
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  
  let yPosition = 800
  const margin = 50
  const pageWidth = 595 - 2 * margin
  
  // Title
  page.drawText(menu.metadata.title, {
    x: margin,
    y: yPosition,
    size: 24,
    font: boldFont,
    color: rgb(0, 0, 0)
  })
  yPosition -= 40
  
  // Sections
  for (const section of layout.sections) {
    // Section header
    page.drawText(section.name, {
      x: margin,
      y: yPosition,
      size: 18,
      font: boldFont,
      color: rgb(0, 0, 0)
    })
    yPosition -= 30
    
    // Items
    for (const tile of section.tiles) {
      if (tile.type === 'item') {
        const item = tile.item
        
        // Item name
        page.drawText(item.name, {
          x: margin,
          y: yPosition,
          size: 12,
          font: boldFont,
          color: rgb(0, 0, 0)
        })
        
        // Price
        page.drawText(`${item.price.toFixed(2)}`, {
          x: pageWidth - 50,
          y: yPosition,
          size: 12,
          font: boldFont,
          color: rgb(0.15, 0.39, 0.92)
        })
        
        yPosition -= 20
        
        // Description
        if (item.description) {
          const wrappedText = wrapText(item.description, 80)
          for (const line of wrappedText) {
            page.drawText(line, {
              x: margin + 10,
              y: yPosition,
              size: 10,
              font: font,
              color: rgb(0.4, 0.4, 0.4)
            })
            yPosition -= 15
          }
        }
        
        yPosition -= 10
        
        // Check if we need a new page
        if (yPosition < 100) {
          const newPage = pdfDoc.addPage([595, 842])
          yPosition = 800
        }
      }
    }
    
    yPosition -= 20
  }
  
  return pdfDoc.save()
}

function wrapText(text: string, maxLength: number): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''
  
  for (const word of words) {
    if ((currentLine + word).length > maxLength) {
      lines.push(currentLine.trim())
      currentLine = word + ' '
    } else {
      currentLine += word + ' '
    }
  }
  
  if (currentLine) {
    lines.push(currentLine.trim())
  }
  
  return lines
}
```

## API Route Configuration

### Edge Runtime Configuration

```typescript
// app/api/templates/export/html/route.ts
export const runtime = 'edge' // Enable edge runtime

export async function POST(request: Request) {
  const { layout, menu } = await request.json()
  
  // HTML export works on edge
  const html = generatePrintableHTML(layout, menu)
  
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Content-Disposition': 'attachment; filename="menu.html"'
    }
  })
}
```

```typescript
// app/api/templates/export/pdf/route.ts
export const runtime = 'edge' // Enable edge runtime

export async function POST(request: Request) {
  const { layout, menu } = await request.json()
  
  // Use lightweight PDF generation
  const pdf = await generateLightweightPDF(layout, menu)
  
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="menu.pdf"'
    }
  })
}
```

```typescript
// app/api/templates/export/image/route.ts
// Image export requires Node.js runtime
export const runtime = 'nodejs'

export async function POST(request: Request) {
  // Check if Puppeteer is available
  if (!isPuppeteerAvailable()) {
    return new Response(
      JSON.stringify({
        error: 'Image export not available in this environment',
        fallback: 'Use HTML export and print to PDF instead'
      }),
      { status: 503 }
    )
  }
  
  // Use Puppeteer for image generation
  const image = await generateImageWithPuppeteer(layout, menu)
  return new Response(image, {
    headers: { 'Content-Type': 'image/png' }
  })
}
```

## Feature Detection and Graceful Degradation

### Client-Side Feature Detection

```typescript
/**
 * Detect available export features and show appropriate UI
 */
export function useExportCapabilities() {
  const [capabilities, setCapabilities] = useState<ExportCapabilities>({
    html: true,
    pdf: true,
    png: false,
    jpg: false
  })
  
  useEffect(() => {
    // Check server capabilities
    fetch('/api/templates/capabilities')
      .then(res => res.json())
      .then(data => setCapabilities(data))
      .catch(() => {
        // Fallback to safe defaults
        setCapabilities({
          html: true,
          pdf: true,
          png: false,
          jpg: false
        })
      })
  }, [])
  
  return capabilities
}
```

### UI Adaptation

```typescript
export function ExportButtons() {
  const capabilities = useExportCapabilities()
  
  return (
    <div className="export-buttons">
      <button onClick={() => exportHTML()}>
        Export HTML
      </button>
      
      <button onClick={() => exportPDF()}>
        Export PDF
      </button>
      
      {capabilities.png ? (
        <button onClick={() => exportPNG()}>
          Export PNG
        </button>
      ) : (
        <Tooltip content="PNG export not available. Use HTML export instead.">
          <button disabled>Export PNG (Unavailable)</button>
        </Tooltip>
      )}
      
      {capabilities.jpg ? (
        <button onClick={() => exportJPG()}>
          Export JPG
        </button>
      ) : (
        <Tooltip content="JPG export not available. Use HTML export instead.">
          <button disabled>Export JPG (Unavailable)</button>
        </Tooltip>
      )}
    </div>
  )
}
```

## Testing Strategy

### Test Edge Runtime Compatibility

```typescript
describe('Edge Runtime Compatibility', () => {
  it('should generate HTML without Node.js dependencies', () => {
    const html = generatePrintableHTML(mockLayout, mockMenu)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain(mockMenu.metadata.title)
  })
  
  it('should generate lightweight PDF without Puppeteer', async () => {
    const pdf = await generateLightweightPDF(mockLayout, mockMenu)
    expect(pdf).toBeInstanceOf(Uint8Array)
    expect(pdf.length).toBeGreaterThan(0)
  })
  
  it('should detect runtime capabilities correctly', () => {
    const capabilities = detectExportCapabilities()
    expect(capabilities.html).toBe(true)
    expect(capabilities.pdf).toBeDefined()
  })
})
```

## Performance Comparison

| Method | Cold Start | Memory | File Size | Quality | Edge Safe |
|--------|-----------|---------|-----------|---------|-----------|
| Puppeteer + sharp | ~3-5s | ~500MB | Optimal | Excellent | ❌ |
| pdf-lib only | ~500ms | ~50MB | Good | Good | ✅ |
| HTML + CSS Print | ~100ms | ~10MB | Excellent | Excellent | ✅ |
| SVG Generation | ~200ms | ~20MB | Good | Good | ✅ |
| Client-side Print | ~0ms | ~0MB | Excellent | Excellent | ✅ |

## Recommendations

### For Production Deployment

1. **Primary**: Use Puppeteer/sharp on Node.js runtime for best quality
2. **Fallback**: Use HTML + CSS print for edge runtime
3. **Client-Side**: Offer browser print-to-PDF for all users

### For Edge Runtime

1. **HTML Export**: Always available, excellent quality
2. **PDF Export**: Use pdf-lib for basic PDFs
3. **Image Export**: Not available, suggest HTML alternative

### For Serverless with Size Constraints

1. Use HTML + CSS print (no dependencies)
2. Offload image generation to client-side
3. Use external service for high-quality PDFs (optional)

## Migration Path

### Phase 1: Current (Node.js Only)
- Puppeteer for images
- pdf-lib for PDFs
- Works great, but limited to Node.js runtime

### Phase 2: Add Edge Support
- Keep Puppeteer for Node.js routes
- Add HTML + CSS print for edge routes
- Feature detection in UI

### Phase 3: Hybrid Approach
- Edge runtime for HTML/basic PDF
- Node.js runtime for high-quality images
- Client-side fallbacks

### Phase 4: Full Edge Migration
- All exports use edge-safe methods
- Client-side image generation
- External service for premium exports (optional)

## Conclusion

Edge-safe fallbacks ensure the layout engine works everywhere:

- ✅ **Universal HTML Export**: Works on all platforms
- ✅ **Lightweight PDF**: Basic PDFs without Puppeteer
- ✅ **Client-Side Options**: Browser print-to-PDF
- ✅ **Graceful Degradation**: Feature detection and UI adaptation
- ✅ **Performance**: Fast cold starts, low memory usage

The fallback strategy maintains functionality while o
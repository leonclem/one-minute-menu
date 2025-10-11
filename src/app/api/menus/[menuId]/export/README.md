# Menu Export API

## Endpoint

`GET /api/menus/[menuId]/export`

## Description

Exports a menu to PDF, PNG, or WebP format with template rendering. Supports both preview and export modes with different rendering characteristics.

## Authentication

Requires authenticated user. The menu must belong to the authenticated user.

## Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `format` | `'pdf' \| 'png' \| 'webp'` | `'pdf'` | Output format |
| `dpi` | `300 \| 600` | `300` | Resolution in dots per inch |
| `size` | `'A4' \| 'A3'` | `'A4'` | Paper size |
| `mode` | `'preview' \| 'export'` | `'export'` | Rendering mode |
| `composite` | `'true' \| 'false'` | `'true'` | Whether to composite with background |

## Mode Differences

### Preview Mode (`mode=preview`)
- Web-safe rendering
- Truncated descriptions for faster rendering
- No AI credits consumed
- Uses cached backgrounds
- Lighter validation
- Cached for 5 minutes

### Export Mode (`mode=export`)
- Full pagination with fit engine
- Complete content rendering
- Spellcheck enforced (TODO: Task 33)
- Blocking errors if accessibility/contrast fail
- Saves render metadata for reproducible exports
- No caching

## Composite Option

### Composite Enabled (`composite=true`)
- Text layer composited with AI-generated background
- Background applied via CSS background-image
- Full-color output suitable for digital display

### Composite Disabled (`composite=false`)
- Text-only PDF for print houses
- No background image applied
- Allows print houses to apply their own backgrounds
- Smaller file size

## Response

### Success (200 OK)

Returns the exported file as a binary download with appropriate headers:

```
Content-Type: application/pdf | image/png | image/webp
Content-Disposition: attachment; filename="menu-name-2025-10-11.pdf"
Content-Length: <file-size>
Cache-Control: public, max-age=300 (preview) | private, no-cache (export)
```

### Error Responses

#### 400 Bad Request
- Invalid parameters
- Menu doesn't have a template applied
- Content doesn't fit within template constraints
- Accessibility requirements not met

```json
{
  "error": "Content does not fit within template constraints",
  "warnings": ["Content still overflows by 150px after applying all policies"],
  "suggestions": [
    "Reduce content length",
    "Use shorter descriptions",
    "Remove some menu items",
    "Choose a different template"
  ]
}
```

#### 401 Unauthorized
- User not authenticated

#### 404 Not Found
- Menu not found
- Menu doesn't belong to user
- Template not found

#### 500 Internal Server Error
- Export failed
- Rendering error

## Example Usage

### Export to PDF (default)
```
GET /api/menus/abc123/export
```

### Preview as PNG
```
GET /api/menus/abc123/export?format=png&mode=preview
```

### High-resolution PDF for print
```
GET /api/menus/abc123/export?format=pdf&dpi=600&size=A4
```

### Text-only PDF for print house
```
GET /api/menus/abc123/export?format=pdf&composite=false
```

## Implementation Details

### Rendering Pipeline

1. **Authentication & Validation**
   - Verify user authentication
   - Validate query parameters
   - Check menu ownership

2. **Template Loading**
   - Load menu with template configuration
   - Load template descriptor
   - Get existing render metadata (if available)

3. **HTML Rendering**
   - Create MenuRenderer with appropriate options
   - Apply fit engine (export mode only)
   - Generate HTML with embedded styles
   - Apply background (if composite enabled)

4. **Validation (Export Mode)**
   - Check fit engine success
   - Validate accessibility requirements
   - Check for font size violations
   - TODO: Spellcheck validation (Task 33)
   - TODO: Contrast validation (Task 27)

5. **Metadata Persistence (Export Mode)**
   - Save render metadata to menu record
   - Enables reproducible exports

6. **Export**
   - Use MenuExporter to convert HTML to requested format
   - Apply DPI scaling
   - Validate glyph coverage (export mode)
   - Return file as download

### Reproducible Exports

In export mode, the render metadata (applied policies, font sizes, pagination points) is saved to the menu record. This ensures that subsequent exports produce identical results without re-running the fit engine.

### Performance Considerations

- Preview mode is cached for 5 minutes
- Export mode is not cached to ensure fresh validation
- Fit engine only runs in export mode
- Background images are loaded from Supabase storage

## Requirements Satisfied

- **8.1**: PDF generation at A4 size with 300 DPI
- **8.2**: PNG generation at specified DPI
- **8.4**: Playwright rendering with timeout and retry
- **8.6**: Preview/export separation with different validation levels

## Future Enhancements

- [ ] Task 27: Implement contrast validation
- [ ] Task 33: Implement spellcheck with allow-list
- [ ] Support for A3 paper size (currently validated but not fully tested)
- [ ] Support for 600 DPI (currently validated but not fully tested)
- [ ] WebP format support (currently returns PNG)
- [ ] PDF/X-4 support for professional printing
- [ ] Signed URLs for long-lived print job access

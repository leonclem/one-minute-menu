# Layout Lab - Developer Test Harness

The Layout Lab is a developer-only interface for testing and validating the V2 layout engine with various fixture menus. It provides a visual interface to experiment with different templates, fixtures, and rendering options.

## Access Requirements

1. **Admin Authentication**: Must be logged in as an admin user
2. **Environment Flag**: `NEXT_PUBLIC_LAYOUT_LAB_ENABLED=true` must be set
3. **Route**: Access at `/dev/layout-lab`

## Features

### Test Data Selection
- **Tiny**: 1-3 items for basic testing
- **Medium**: 20-40 items with mixed sections and images
- **Large**: 100+ items to test pagination behavior
- **Nasty**: Edge cases with long text, missing data, and many indicators

### Template Selection
- **Classic Cards V2**: 4-column grid layout (MVP template)

### Engine Comparison
- **V1**: Legacy engine (comparison mode)
- **V2**: New PDF-first streaming engine

### Display Options
- **Grid/bounds overlay**: Shows grid structure and boundaries
- **Region rectangles**: Highlights header, title, body, footer regions
- **Tile IDs and coordinates**: Shows tile positioning information
- **Fillers on/off**: Toggle filler tile insertion
- **Text only**: Disable images for text-only layouts
- **Textured backgrounds**: Enable paper textures for Midnight Gold and Elegant Dark palettes
- **Show menu title**: Display the menu name in the title region. When disabled, space is redistributed to menu items for better layout efficiency

### Export Options
- **Generate Layout**: Creates layout and shows preview
- **Export PDF**: Downloads PDF version of the layout
- **Download Layout JSON**: Downloads the raw layout document for debugging

## Environment Configuration

Add these variables to your `.env.local`:

```bash
# Enable Layout Lab (dev only)
NEXT_PUBLIC_LAYOUT_LAB_ENABLED=true

# Set default engine version
NEXT_PUBLIC_LAYOUT_ENGINE_VERSION=v2
```

## Usage

1. Navigate to `/dev/layout-lab` (requires admin login)
2. Select a fixture menu from the test data options
3. Choose a template (Classic Cards V2 for MVP)
4. Select engine version (V2 recommended)
5. Configure display options as needed
6. Click "Generate Layout" to create the preview
7. Use page navigation for multi-page layouts
8. Export PDF or download JSON as needed

## Development Notes

- The Layout Lab uses the same V2 engine components as production
- Fixtures are stored in `src/lib/templates/v2/fixtures/`
- Templates are defined in `src/lib/templates/v2/templates/`
- Debug information is available when using V2 engine
- PDF export uses the same renderer as production

## Troubleshooting

- **403 Forbidden**: Check admin authentication and environment flag
- **404 Not Found**: Ensure fixture and template files exist
- **500 Server Error**: Check server logs for V2 engine errors
- **Layout Issues**: Use display overlays to debug positioning

## Security

- Layout Lab is admin-only and disabled by default in production
- Environment flag provides additional protection
- All fixture data is static and safe for testing
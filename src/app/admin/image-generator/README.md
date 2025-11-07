# Imagen 4.0 Generator

A comprehensive admin tool for generating high-quality images using Google's Imagen 4.0 AI.

## Features

- **Multiple Aspect Ratios**: Generate images in 1:1 (Square), 4:3 (Fullscreen), 3:4 (Portrait), 16:9 (Widescreen), or 9:16 (Vertical) formats
- **High-Resolution Support**: Choose between 1K (1024px) and 2K (2048px) quality levels
- **Advanced AI Model**: Uses Imagen 4.0, Google's latest and most advanced image generation model
- **Secure Downloads**: Proper file downloads that bypass CSP restrictions
- **Shareable URLs**: Create temporary shareable URLs for generated images
- **Full-Size Viewing**: Open images in new tabs for detailed inspection
- **Generation History**: View all generated images in the current session with metadata
- **Safety Controls**: Built-in content filtering to block harmful content

## Usage

1. Navigate to `/admin/image-generator` (admin access required)
2. Enter a descriptive text prompt
3. Select desired aspect ratio (1:1, 4:3, 3:4, 16:9, or 9:16)
4. Choose image quality (1K or 2K)
5. Click "Generate Image"
5. Use the action buttons to:
   - **Download**: Save image as PNG file
   - **Copy URL**: Get a shareable temporary URL (expires in 1 hour)
   - **View Full Size**: Open image in new tab

## API Endpoints

- `POST /api/admin/generate-image` - Generate new image
  - Requires: `{ prompt: string, aspectRatio?: string, imageSize?: string, numberOfImages?: number }`
  - Returns: `{ imageUrl: string, prompt: string, aspectRatio: string, imageSize: string }`

- `POST /api/admin/download-image` - Download image file
  - Requires: `{ imageData: string, filename?: string }`
  - Returns: PNG file download

- `POST /api/admin/image-url/create` - Create shareable URL
  - Requires: `{ imageData: string }`
  - Returns: `{ imageUrl: string }`

- `GET /api/admin/image-url/[id]` - Serve temporary image
  - Returns: PNG image (expires in 1 hour)

## Security

- Protected by CSRF middleware
- Admin-only access (not indexed or exposed to regular users)
- Uses existing Gemini API key from environment variables
- Temporary URLs expire automatically
- Content safety filtering enabled

## Technical Details

- Uses `imagen-4.0-generate-001` model (Google's latest)
- Supports 1K (1024px) and 2K (2048px) resolutions
- Multiple aspect ratios: 1:1, 4:3, 3:4, 16:9, 9:16
- Returns base64-encoded PNG images
- Includes person generation controls (adults allowed, children blocked)
- Temporary URL storage with automatic cleanup
- CSP-compliant download mechanism
- SynthID watermarking included automatically
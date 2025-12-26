# General Purpose Image Generator

A backup image generator using Gemini 2.5 Flash for general admin purposes, creating assets, and other non-restaurant specific needs.

## Purpose

This generator serves as a reliable alternative to the Imagen 4.0 generator when it becomes temperamental. It's designed for general admin use cases without the restaurant-specific controls found in the other Gemini generator.

## Features

- **Reliable Backend**: Uses Gemini 2.5 Flash for consistent image generation
- **Multiple Aspect Ratios**: Supports 1:1, 4:3, 3:4, 16:9, and 9:16 aspect ratios
- **General Purpose**: No restaurant-specific controls or reference image features
- **Admin Only**: Requires admin authentication to access
- **Permissive Settings**: Allows person generation for more flexible admin use

## Usage

1. Navigate to `/admin/general-image-generator` (admin access required)
2. Enter a descriptive text prompt
3. Select desired aspect ratio
4. Click "Generate Image"
5. Download, copy URL, or view full size of generated images

## Access

Available through the Admin Hub dropdown menu under "AI Image Tools" → "General Purpose (Backup)"

## API Endpoint

- **Endpoint**: `/api/admin/generate-general-image`
- **Method**: POST
- **Authentication**: Admin required
- **Backend**: Gemini 2.5 Flash via nano-banana client
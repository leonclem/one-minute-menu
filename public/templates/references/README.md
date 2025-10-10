# Template Reference Images

This directory contains reference style images used to guide AI background generation for menu templates.

## Purpose

Reference images serve as visual guidance for the nano-banana AI image generation service. They help establish the aesthetic style, texture, and mood that should be reflected in generated menu backgrounds.

## Current Templates

### kraft-sports-reference.jpg
- **Style**: Rustic, textured kraft paper with sports bar aesthetic
- **Colors**: Warm browns, beiges, kraft paper tones (#E8DCC8)
- **Texture**: Rough paper texture, vintage feel
- **Mood**: Casual, energetic, sports-themed

### minimal-bistro-reference.jpg
- **Style**: Clean, elegant, minimalist fine dining
- **Colors**: Soft whites, subtle grays, elegant neutrals
- **Texture**: Smooth, refined, subtle texture
- **Mood**: Sophisticated, calm, upscale

## Image Requirements

- **Format**: JPEG or PNG
- **Resolution**: Minimum 1024x1024 pixels
- **Aspect Ratio**: Square or A4 portrait (210x297mm ratio)
- **File Size**: Under 5MB for optimal loading
- **Content**: Should represent the overall aesthetic without text or specific menu items

## Adding New Templates

When creating a new template:

1. Create a reference image that captures the desired aesthetic
2. Name it `{template-id}-reference.jpg`
3. Place it in this directory
4. Reference it in the template descriptor's `layers.background.src` field
5. Update this README with the new template's style description

## Notes

- Reference images are used for AI generation guidance only
- They are not directly displayed in the final menu output
- The AI will use these to inform color palette, texture, and overall style
- Fallback solid colors are defined in each template descriptor

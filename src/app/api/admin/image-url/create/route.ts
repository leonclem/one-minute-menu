import { NextRequest, NextResponse } from 'next/server';

// Import shared storage (in production, use Redis or similar)
declare global {
  var __IMAGE_STORE__: Map<string, { data: string; timestamp: number }> | undefined;
}

const imageStore = globalThis.__IMAGE_STORE__ || new Map<string, { data: string; timestamp: number }>();
globalThis.__IMAGE_STORE__ = imageStore;

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json();
    
    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Generate a unique ID for this image
    const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store the image data temporarily
    imageStore.set(id, {
      data: imageData,
      timestamp: Date.now()
    });

    // Return the URL
    const url = new URL(request.url);
    const imageUrl = `${url.origin}/api/admin/image-url/${id}`;

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error('Error storing image:', error);
    return NextResponse.json(
      { error: 'Failed to store image' },
      { status: 500 }
    );
  }
}
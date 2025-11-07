import { NextRequest, NextResponse } from 'next/server';

// Import shared storage (in production, use Redis or similar)
declare global {
  var __IMAGE_STORE__: Map<string, { data: string; timestamp: number }> | undefined;
}

const imageStore = globalThis.__IMAGE_STORE__ || new Map<string, { data: string; timestamp: number }>();
globalThis.__IMAGE_STORE__ = imageStore;

// Clean up old entries (older than 1 hour)
const cleanupOldEntries = () => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  const keysToDelete: string[] = [];
  
  imageStore.forEach((value, key) => {
    if (value.timestamp < oneHourAgo) {
      keysToDelete.push(key);
    }
  });
  
  keysToDelete.forEach(key => imageStore.delete(key));
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    cleanupOldEntries();
    
    const { id } = params;
    const imageEntry = imageStore.get(id);
    
    if (!imageEntry) {
      return NextResponse.json(
        { error: 'Image not found or expired' },
        { status: 404 }
      );
    }

    // Extract base64 data from data URL
    const base64Data = imageEntry.data.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
}


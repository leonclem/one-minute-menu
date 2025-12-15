import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-api-auth'

export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdminApi()
    if (!admin.ok) return admin.response

    const { imageData, filename } = await request.json();

    if (!imageData) {
      return NextResponse.json(
        { error: 'Image data is required' },
        { status: 400 }
      );
    }

    // Extract base64 data from data URL
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Create response with proper headers for download
    const response = new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Disposition': `attachment; filename="${filename || 'generated-image.png'}"`,
        'Content-Length': buffer.length.toString(),
      },
    });

    return response;
  } catch (error) {
    console.error('Error serving image download:', error);
    return NextResponse.json(
      { error: 'Failed to process download' },
      { status: 500 }
    );
  }
}
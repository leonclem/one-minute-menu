import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, aspectRatio = '1:1', imageSize = '2K', numberOfImages = 1 } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.NANO_BANANA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Gemini API key not configured' },
        { status: 500 }
      );
    }

    // Construct the request body for Imagen API
    const instanceData: any = {
      prompt: `${prompt}. High quality, detailed image.`
    };

    // Clean prompt without reference image complications
    instanceData.prompt = `${prompt}. High quality, detailed image.`;

    const requestBody = {
      instances: [instanceData],
      parameters: {
        sampleCount: numberOfImages,
        aspectRatio: aspectRatio,
        imageSize: imageSize,
        personGeneration: "allow_adult" // Default to allow adults but not children
      }
    };

    // Make request to Imagen 4.0 API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      return NextResponse.json(
        { 
          error: 'Failed to generate image',
          details: errorText,
          status: response.status
        },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    // Extract the image data from the Imagen response
    if (data.predictions && data.predictions[0]) {
      const prediction = data.predictions[0];
      
      if (prediction.bytesBase64Encoded && prediction.mimeType) {
        const imageUrl = `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;
        
        return NextResponse.json({
          imageUrl,
          prompt,
          aspectRatio,
          imageSize,
        });
      }
    }

    return NextResponse.json(
      { error: 'No image data found in response' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Error generating image:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
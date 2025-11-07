'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface GeneratedImage {
  url: string;
  prompt: string;
  timestamp: Date;
  aspectRatio: string;
  imageSize: string;
}

export function ImageGeneratorClient() {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [imageSize, setImageSize] = useState('2K');

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const generateImage = async () => {
    if (!prompt.trim()) {
      showMessage('error', 'Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/admin/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          prompt, 
          aspectRatio, 
          imageSize,
          numberOfImages: 1
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate image');
      }

      const data = await response.json();
      
      const newImage: GeneratedImage = {
        url: data.imageUrl,
        prompt,
        timestamp: new Date(),
        aspectRatio: data.aspectRatio || aspectRatio,
        imageSize: data.imageSize || imageSize,
      };

      setGeneratedImages(prev => [newImage, ...prev]);
      showMessage('success', 'Image generated successfully!');
      setPrompt('');
    } catch (error) {
      console.error('Error generating image:', error);
      showMessage('error', 'Failed to generate image');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadImage = async (imageUrl: string, prompt: string) => {
    try {
      const filename = `generated-image-${Date.now()}.png`;
      
      // Use our download API endpoint to handle the data URL properly
      const response = await fetch('/api/admin/download-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          imageData: imageUrl, 
          filename 
        }),
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showMessage('success', 'Image downloaded!');
    } catch (error) {
      console.error('Error downloading image:', error);
      showMessage('error', 'Failed to download image');
    }
  };

  const copyImageUrl = async (imageUrl: string, index: number) => {
    try {
      // Create a temporary URL for the image
      const response = await fetch('/api/admin/image-url/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData: imageUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to create shareable URL');
      }

      const data = await response.json();
      await navigator.clipboard.writeText(data.imageUrl);
      setCopiedIndex(index);
      showMessage('success', 'Shareable image URL copied to clipboard!');
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Error copying URL:', error);
      showMessage('error', 'Failed to copy URL');
    }
  };

  const viewFullSize = async (imageUrl: string) => {
    try {
      // Create a temporary URL for viewing
      const response = await fetch('/api/admin/image-url/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageData: imageUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to create viewable URL');
      }

      const data = await response.json();
      window.open(data.imageUrl, '_blank');
    } catch (error) {
      console.error('Error opening full size view:', error);
      showMessage('error', 'Failed to open full size view');
    }
  };



  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Message Display */}
      {message && (
        <div className={`mb-4 p-4 rounded-md ${
          message.type === 'success' 
            ? 'bg-green-50 text-green-800 border border-green-200' 
            : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          {message.text}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Imagen 4.0 Generator</h1>
        <p className="text-gray-600">
          Generate high-quality images using Google's Imagen 4.0 AI with custom aspect ratios and 2K resolution. Admin-only tool.
        </p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Generate New Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <textarea
            placeholder="Enter your image prompt here... (e.g., 'A serene mountain landscape at sunset with a lake in the foreground')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            className="w-full p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio:</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1:1">1:1 (Square)</option>
                <option value="4:3">4:3 (Fullscreen)</option>
                <option value="3:4">3:4 (Portrait Fullscreen)</option>
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="9:16">9:16 (Portrait/Vertical)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Image Quality:</label>
              <select
                value={imageSize}
                onChange={(e) => setImageSize(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="1K">1K (1024px) - Standard</option>
                <option value="2K">2K (2048px) - High Quality</option>
              </select>
            </div>
          </div>
          <div className="text-sm text-gray-600 bg-green-50 p-3 rounded border border-green-200">
            <strong>✨ Imagen 4.0!</strong> High-quality image generation with custom aspect ratios and 2K resolution support.
          </div>
          <Button 
            onClick={generateImage} 
            disabled={isGenerating || !prompt.trim()}
            className="w-full"
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Button>
        </CardContent>
      </Card>

      {generatedImages.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Generated Images</h2>
          <div className="grid gap-6">
            {generatedImages.map((image, index) => (
              <Card key={index} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Prompt:</h3>
                        <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                          {image.prompt}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">
                          Generated: {image.timestamp.toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-500">
                          Aspect Ratio: {image.aspectRatio} | Quality: {image.imageSize}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => downloadImage(image.url, image.prompt)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => copyImageUrl(image.url, index)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          {copiedIndex === index ? 'Copied!' : 'Copy URL'}
                        </button>
                        <button
                          onClick={() => viewFullSize(image.url)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                        >
                          View Full Size
                        </button>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={image.url}
                        alt={image.prompt}
                        className="max-w-full h-auto rounded-lg shadow-lg"
                        style={{ maxHeight: '300px' }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
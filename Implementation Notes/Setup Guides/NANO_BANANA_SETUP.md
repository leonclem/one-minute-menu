# Nano Banana API Setup Guide

## What is Nano Banana?

**Nano Banana** is the display name for Google's Gemini 2.5 Flash Image generation models. It's part of the Google Generative AI API (formerly Gemini API).

## Available Models

The following models support image generation:

1. **gemini-2.5-flash-image** (Recommended)
   - Display Name: "Nano Banana"
   - Method: `generateContent`
   - Status: ✅ Available (requires quota)

2. **gemini-2.5-flash-image-preview**
   - Display Name: "Nano Banana"  
   - Method: `generateContent`
   - Status: ✅ Available (requires quota)

3. **imagen-3.0-generate-002**
   - Display Name: "Imagen 3.0"
   - Method: `predict`
   - Status: ⚠️ Requires billing enabled

4. **imagen-4.0-generate-preview-06-06**
   - Display Name: "Imagen 4 (Preview)"
   - Method: `predict`
   - Status: ⚠️ Requires billing enabled

## Current Implementation

The app is now configured to use `gemini-2.5-flash-image` which is the Nano Banana model.

**Endpoint:**
```
https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent
```

**Request Format:**
```json
{
  "contents": [{
    "parts": [{
      "text": "Generate an image of: [your prompt here]"
    }]
  }],
  "generationConfig": {
    "responseModalities": ["image"]
  }
}
```

**Response Format:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "inlineData": {
          "mimeType": "image/png",
          "data": "[base64 encoded image]"
        }
      }]
    }
  }]
}
```

## API Key Setup

Create `.env.local` and add:
```
NANO_BANANA_API_KEY=your_google_api_key_here
```
Never commit real API keys. Use `.env.local.example` with placeholders for sharing.

## Current Issue: Quota Exceeded

The API key has exceeded its free tier quota. You'll see errors like:

```
429 - You exceeded your current quota
* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
```

### Solutions:

1. **Wait for quota reset** (recommended for testing)
   - Free tier quotas reset periodically
   - The error message shows how long to wait (usually ~60 seconds)

2. **Enable billing** (recommended for production)
   - Go to [Google AI Studio](https://aistudio.google.com/)
   - Enable billing on your project
   - This gives you much higher quotas

3. **Get a new API key**
   - Create a new project in Google Cloud Console
   - Enable the Generative Language API
   - Create a new API key

## Testing

Run the test script to verify the API is working:

```bash
node test-gemini-image.js
```

This will attempt to generate a test image and show you the response structure.

## Free Tier Limits

Google's free tier for Gemini API includes:
- 15 requests per minute (RPM)
- 1 million tokens per minute (TPM)
- 1,500 requests per day (RPD)

Image generation counts against these limits.

## Next Steps

1. **Enable billing** on your Google Cloud project to get higher quotas
2. **Test the integration** once quota is available
3. **Monitor usage** to stay within limits

## Documentation

- [Google AI Studio](https://aistudio.google.com/)
- [Gemini API Documentation](https://ai.google.dev/gemini-api/docs)
- [Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)

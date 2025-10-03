import { ImageAnnotatorClient } from '@google-cloud/vision'

let visionClient: ImageAnnotatorClient | null = null

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    // Initialize Google Vision client
    // In production, this will use the service account key from environment
    visionClient = new ImageAnnotatorClient({
      // If GOOGLE_APPLICATION_CREDENTIALS is set, it will use that
      // Otherwise, we can pass credentials directly
      ...(process.env.GOOGLE_CREDENTIALS_JSON && {
        credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
      })
    })
  }
  return visionClient
}

export async function extractTextFromImage(imageUrl: string): Promise<{
  text: string
  confidence: number
}> {
  try {
    const client = getVisionClient()
    
    // Fetch the image from the URL
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`)
    }
    
    const imageBuffer = await response.arrayBuffer()
    const imageBytes = new Uint8Array(imageBuffer)
    
    // Perform text detection
    const [result] = await client.documentTextDetection({
      image: { content: imageBytes }
    })
    
    const fullTextAnnotation = result.fullTextAnnotation
    if (!fullTextAnnotation || !fullTextAnnotation.text) {
      return { text: '', confidence: 0 }
    }
    
    // Calculate average confidence from all detected text
    const pages = fullTextAnnotation.pages || []
    let totalConfidence = 0
    let confidenceCount = 0
    
    for (const page of pages) {
      const blocks = page.blocks || []
      for (const block of blocks) {
        if (block.confidence !== undefined && block.confidence !== null) {
          totalConfidence += block.confidence
          confidenceCount++
        }
      }
    }
    
    const averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0
    
    return {
      text: fullTextAnnotation.text.trim(),
      confidence: Math.round(averageConfidence * 100) / 100 // Round to 2 decimal places
    }
  } catch (error) {
    console.error('Vision API error:', error)
    throw new Error(`OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}
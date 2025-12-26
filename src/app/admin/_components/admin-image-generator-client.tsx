'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PromptHelperPanel } from '@/app/admin/_components/prompt-helper-panel'

interface GeneratedImage {
  url: string
  prompt: string
  timestamp: Date
  aspectRatio: string
  imageSize?: string
}

type ApiResponse =
  | {
      imageUrl: string
      images?: string[]
      prompt: string
      aspectRatio?: string
      imageSize?: string
      model?: string
    }
  | {
      error: string
      details?: string
      status?: number
    }

export interface AdminImageGeneratorClientProps {
  title: string
  description: string
  endpoint: string
  badgeText?: string
  noteText?: string
  supportsImageSize?: boolean
  defaultAspectRatio?: string
  defaultImageSize?: string
  allowedAspectRatios?: Array<'1:1' | '4:3' | '3:4' | '16:9' | '9:16'>
  supportsReferenceImage?: boolean
  context?: 'food' | 'general'
}

export function AdminImageGeneratorClient({
  title,
  description,
  endpoint,
  badgeText,
  noteText,
  supportsImageSize = true,
  defaultAspectRatio = '1:1',
  defaultImageSize = '2K',
  allowedAspectRatios = ['1:1', '4:3', '3:4', '16:9', '9:16'],
  supportsReferenceImage = false,
  context = 'food',
}: AdminImageGeneratorClientProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([])
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio)
  const [imageSize, setImageSize] = useState(defaultImageSize)
  const [referenceMode, setReferenceMode] = useState<'style_match' | 'composite'>('style_match')
  const [referenceImages, setReferenceImages] = useState<Array<{
    id: string
    dataUrl: string
    name: string
    role: string
  }>>([])
  const [scenarioId, setScenarioId] = useState<string | null>(null)

  // Define role options based on context
  const roleOptions = useMemo(() => {
    if (context === 'general') {
      return [
        { value: 'subject', label: 'Subject (use this as the main focus)' },
        { value: 'background', label: 'Background (use this as the environment)' },
        { value: 'style', label: 'Style (match lighting/grading)' },
        { value: 'other', label: 'Other' },
      ]
    } else {
      return [
        { value: 'dish', label: 'Dish (use this as the food)' },
        { value: 'scene', label: 'Scene (use this as the table/background)' },
        { value: 'style', label: 'Style (match lighting/grading)' },
        { value: 'other', label: 'Other' },
      ]
    }
  }, [context])

  // Get default role for new images based on context
  const getDefaultRole = (index: number) => {
    if (context === 'general') {
      return index === 0 ? 'subject' : index === 1 ? 'background' : 'style'
    } else {
      return index === 0 ? 'dish' : index === 1 ? 'scene' : 'style'
    }
  }

  const estimateDataUrlBytes = (dataUrl: string): number => {
    const idx = dataUrl.indexOf('base64,')
    if (idx < 0) return 0
    const b64 = dataUrl.slice(idx + 'base64,'.length)
    const padding = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
    return Math.floor((b64.length * 3) / 4) - padding
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 3000)
  }

  const downloadImage = async (imageUrl: string) => {
    try {
      const filename = `generated-image-${Date.now()}.png`
      const response = await fetch('/api/admin/download-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: imageUrl, filename }),
      })

      if (!response.ok) throw new Error('Download failed')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      showMessage('success', 'Image downloaded!')
    } catch (error) {
      console.error('Error downloading image:', error)
      showMessage('error', 'Failed to download image')
    }
  }

  const copyImageUrl = async (imageUrl: string, index: number) => {
    try {
      const response = await fetch('/api/admin/image-url/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: imageUrl }),
      })

      if (!response.ok) throw new Error('Failed to create shareable URL')

      const data = await response.json()
      await navigator.clipboard.writeText(data.imageUrl)
      setCopiedIndex(index)
      showMessage('success', 'Shareable image URL copied to clipboard!')
      setTimeout(() => setCopiedIndex(null), 2000)
    } catch (error) {
      console.error('Error copying URL:', error)
      showMessage('error', 'Failed to copy URL')
    }
  }

  const viewFullSize = async (imageUrl: string) => {
    try {
      const response = await fetch('/api/admin/image-url/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: imageUrl }),
      })

      if (!response.ok) throw new Error('Failed to create viewable URL')

      const data = await response.json()
      window.open(data.imageUrl, '_blank')
    } catch (error) {
      console.error('Error opening full size view:', error)
      showMessage('error', 'Failed to open full size view')
    }
  }

  const generateImage = async () => {
    if (!prompt.trim()) {
      showMessage('error', 'Please enter a prompt')
      return
    }

    setIsGenerating(true)
    try {
      const body: any = {
        prompt,
        aspectRatio,
        numberOfImages: 1,
      }
      if (supportsImageSize) body.imageSize = imageSize
      if (supportsReferenceImage) {
        body.referenceMode = referenceMode
        body.referenceImages = referenceImages.map((r) => ({
          dataUrl: r.dataUrl,
          role: r.role,
          name: r.name,
        }))
        body.scenarioId = scenarioId
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as any
        console.log('🔍 [Frontend] API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorData: err
        })
        
        // Handle structured error responses from our API
        if (err?.code && err?.suggestions) {
          const errorMessage = `${err.error}\n\nSuggestions:\n${err.suggestions.map((s: string) => `• ${s}`).join('\n')}`
          throw new Error(errorMessage)
        }
        
        throw new Error(err?.error || `Request failed with status ${response.status}`)
      }

      const data = (await response.json()) as ApiResponse
      if ('error' in data) throw new Error(data.error)

      const urls = data.images && data.images.length > 0 ? data.images : [data.imageUrl]
      const now = new Date()
      const newImages: GeneratedImage[] = urls.map((u) => ({
        url: u,
        prompt,
        timestamp: now,
        aspectRatio: data.aspectRatio || aspectRatio,
        imageSize: supportsImageSize ? (data.imageSize || imageSize) : undefined,
      }))

      setGeneratedImages((prev) => [...newImages, ...prev])
      showMessage('success', 'Image generated successfully!')
      setPrompt('')
    } catch (error) {
      console.error('Error generating image:', error)
      showMessage('error', error instanceof Error ? error.message : 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {message && (
        <div
          className={`mb-4 p-4 rounded-md ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{title}</h1>
        <p className="text-gray-600">{description}</p>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Generate New Image</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {supportsReferenceImage && context === 'food' && (
            <div className="rounded-md border border-gray-200 bg-white p-4">
              <PromptHelperPanel
                mode={referenceMode}
                onScenarioChange={(id) => setScenarioId(id)}
                currentPrompt={prompt}
                onReplacePrompt={(p) => setPrompt(p)}
                onAppend={(text) => setPrompt((p) => (p ? `${p}\n\n${text}` : text))}
                onReplace={(text) => setPrompt(text)}
              />
            </div>
          )}

          {supportsReferenceImage && context === 'general' && (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-4">
              <h3 className="font-semibold text-blue-900 mb-2">General Purpose Image Generation</h3>
              <p className="text-sm text-blue-800">
                This is a clean, general-purpose image generator for creating web assets, graphics, and other non-restaurant content. 
                Simply write your prompt below and optionally add reference images for style matching or composition guidance.
              </p>
            </div>
          )}

          <textarea
            placeholder="Enter your image prompt here..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
            className="w-full p-3 border border-gray-300 rounded-md resize-y min-h-[240px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aspect Ratio:</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {allowedAspectRatios.includes('1:1') && <option value="1:1">1:1 (Square)</option>}
                {allowedAspectRatios.includes('4:3') && <option value="4:3">4:3 (Fullscreen)</option>}
                {allowedAspectRatios.includes('3:4') && <option value="3:4">3:4 (Portrait Fullscreen)</option>}
                {allowedAspectRatios.includes('16:9') && <option value="16:9">16:9 (Widescreen)</option>}
                {allowedAspectRatios.includes('9:16') && <option value="9:16">9:16 (Portrait/Vertical)</option>}
              </select>
            </div>

            {supportsImageSize && (
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
            )}
          </div>

          {supportsReferenceImage && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference Mode:</label>
                  <select
                    value={referenceMode}
                    onChange={(e) => setReferenceMode(e.target.value as any)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="style_match">Style match (same look & feel)</option>
                    <option value="composite">Composite (use reference as context/scene)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Reference Image (optional):</label>
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    onChange={async (e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length === 0) return

                      const remainingSlots = Math.max(0, 3 - referenceImages.length)
                      const toAdd = files.slice(0, remainingSlots)
                      if (toAdd.length < files.length) {
                        showMessage('error', 'You can add up to 3 reference images.')
                      }

                      for (const file of toAdd) {
                        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
                          showMessage('error', `Invalid file type for ${file.name}. Use PNG, JPG, or WebP.`)
                          continue
                        }
                        if (file.size > 7 * 1024 * 1024) {
                          showMessage('error', `Reference image too large: ${file.name} (max 7MB).`)
                          continue
                        }
                        const reader = new FileReader()
                        await new Promise<void>((resolve) => {
                          reader.onload = () => {
                            const result = String(reader.result || '')
                            setReferenceImages((prev) => [
                              ...prev,
                              {
                                id: `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                                dataUrl: result,
                                name: file.name,
                                role: getDefaultRole(prev.length),
                              },
                            ])
                            resolve()
                          }
                          reader.onerror = () => {
                            showMessage('error', `Failed to read image file: ${file.name}`)
                            resolve()
                          }
                          reader.readAsDataURL(file)
                        })
                      }

                      e.target.value = ''
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <p className="mt-1 text-xs text-gray-500">Up to 3 images. PNG/JPEG/WebP. Max 7MB each.</p>
                </div>
              </div>

              {referenceImages.length > 0 && (
                <div className="space-y-3">
                  {referenceImages.map((img) => (
                    <div key={img.id} className="flex items-start gap-4">
                      <img
                        src={img.dataUrl}
                        alt="Reference"
                        className="rounded-md border border-gray-200"
                        style={{ width: 120, height: 120, objectFit: 'cover' }}
                      />
                      <div className="flex-1">
                        <p className="text-sm text-gray-700">
                          <strong>Selected:</strong> {img.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Size: {(estimateDataUrlBytes(img.dataUrl) / (1024 * 1024)).toFixed(2)} MB (max 7MB)
                        </p>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Role:</label>
                            <select
                              value={img.role}
                              onChange={(e) => {
                                const role = e.target.value as any
                                setReferenceImages((prev) => prev.map((p) => (p.id === img.id ? { ...p, role } : p)))
                              }}
                              className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                            >
                              {roleOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={() => setReferenceImages((prev) => prev.filter((p) => p.id !== img.id))}
                              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {badgeText && (
            <div className="text-sm text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
              <strong>✨ {badgeText}</strong>
            </div>
          )}

          {noteText && (
            <div className="text-sm text-gray-700 bg-amber-50 p-3 rounded border border-amber-200">
              {noteText}
            </div>
          )}

          <Button onClick={generateImage} disabled={isGenerating || !prompt.trim()} className="w-full">
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </Button>
        </CardContent>
      </Card>

      {generatedImages.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-2xl font-semibold">Generated Images</h2>
          <div className="grid gap-6">
            {generatedImages.map((image, index) => (
              <Card key={`${image.timestamp.getTime()}-${index}`} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-semibold mb-2">Prompt:</h3>
                        <pre className="text-sm text-gray-600 bg-gray-50 p-3 rounded whitespace-pre-wrap break-words font-sans">
                          {image.prompt}
                        </pre>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-gray-500">Generated: {image.timestamp.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">
                          Aspect Ratio: {image.aspectRatio}
                          {image.imageSize ? ` | Quality: ${image.imageSize}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => downloadImage(image.url)}
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
  )
}



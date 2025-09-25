'use client'

import { useState, useRef, useCallback } from 'react'
import { Button, Card, CardContent } from '@/components/ui'
import CameraCapture from './CameraCapture'
import { validateImageFile, processImage, createThumbnail, rotateImageQuarterTurns } from '@/lib/image-utils'

interface ImageUploadProps {
  onImageSelected: (file: File, preview: string) => void
  onCancel?: () => void
  maxSize?: number
  className?: string
}

export default function ImageUpload({ 
  onImageSelected, 
  onCancel, 
  maxSize = 8 * 1024 * 1024, // 8MB
  className = '' 
}: ImageUploadProps) {
  const [mode, setMode] = useState<'select' | 'camera' | 'preview'>('select')
  const [dragActive, setDragActive] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if device has camera
  const hasCamera = typeof navigator !== 'undefined' && 
    navigator.mediaDevices && 
    navigator.mediaDevices.getUserMedia

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    setError(null)
    setProcessing(true)

    try {
      // Validate file
      const validation = validateImageFile(file)
      if (!validation.valid) {
        setError(validation.error || 'Invalid file')
        return
      }

      // Process image
      const processed = await processImage(file, {
        maxWidth: 2048,
        maxHeight: 2048,
        quality: 0.8,
        stripExif: true,
        autoRotate: true,
        autoDeskew: true,
        autoCrop: true
      })

      // Create preview
      const preview = await createThumbnail(processed.file, 400)
      
      setSelectedFile(processed.file)
      setPreviewImage(preview)
      setMode('preview')
    } catch (err) {
      console.error('Image processing error:', err)
      setError('Failed to process image. Please try again.')
    } finally {
      setProcessing(false)
    }
  }, [])

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Handle file input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  // Handle camera capture
  const handleCameraCapture = useCallback((file: File) => {
    setMode('select')
    handleFileSelect(file)
  }, [handleFileSelect])

  // Confirm selection
  const handleConfirm = useCallback(() => {
    if (selectedFile && previewImage) {
      onImageSelected(selectedFile, previewImage)
    }
  }, [selectedFile, previewImage, onImageSelected])

  // Manual rotate fallback (90° steps)
  const handleRotate = useCallback(async (quarterTurns: number) => {
    if (!selectedFile) return
    setProcessing(true)
    setError(null)
    try {
      const rotated = await rotateImageQuarterTurns(selectedFile, quarterTurns)
      const preview = await createThumbnail(rotated.file, 400)
      setSelectedFile(rotated.file)
      setPreviewImage(preview)
    } catch (e) {
      console.error('Rotate image error:', e)
      setError('Failed to rotate image. Please try again.')
    } finally {
      setProcessing(false)
    }
  }, [selectedFile])

  // Reset to selection mode
  const handleRetake = useCallback(() => {
    setSelectedFile(null)
    setPreviewImage(null)
    setMode('select')
    setError(null)
  }, [])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setSelectedFile(null)
    setPreviewImage(null)
    setMode('select')
    setError(null)
    onCancel?.()
  }, [onCancel])

  if (mode === 'camera') {
    return (
      <div className={`w-full h-96 ${className}`}>
        <CameraCapture
          onCapture={handleCameraCapture}
          onCancel={() => setMode('select')}
          className="w-full h-full"
        />
      </div>
    )
  }

  if (mode === 'preview' && previewImage && selectedFile) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Preview Your Menu Photo
            </h3>
            
            {/* Image preview */}
            <div className="mb-6">
              <img
                src={previewImage}
                alt="Menu preview"
                className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg"
              />
            </div>

            {/* File info */}
            <div className="text-sm text-gray-600 mb-6">
              <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
              <p>Type: {selectedFile.type}</p>
            </div>

            {/* Rotate controls */}
            <div className="flex flex-row gap-3 justify-center mb-3">
              <Button
                variant="outline"
                onClick={() => handleRotate(3)}
                disabled={processing}
              >
                Rotate Left
              </Button>
              <Button
                variant="outline"
                onClick={() => handleRotate(1)}
                disabled={processing}
              >
                Rotate Right
              </Button>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={handleRetake}
                disabled={processing}
              >
                Retake Photo
              </Button>
              <Button
                variant="primary"
                onClick={handleConfirm}
                disabled={processing}
              >
                Use This Photo
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            Upload Menu Photo
          </h3>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Processing state */}
          {processing && (
            <div className="mb-4 p-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">Processing image...</p>
            </div>
          )}

          {/* Upload options */}
          {!processing && (
            <>
              {/* Camera option (mobile) */}
              {hasCamera && (
                <div className="mb-4">
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => setMode('camera')}
                    className="w-full sm:w-auto"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Take Photo
                  </Button>
                </div>
              )}

              {/* Divider */}
              {hasCamera && (
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">or</span>
                  </div>
                </div>
              )}

              {/* File upload area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 transition-colors ${
                  dragActive
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <div className="text-center">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    stroke="currentColor"
                    fill="none"
                    viewBox="0 0 48 48"
                  >
                    <path
                      d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <div className="mt-4">
                    <p className="text-sm text-gray-600">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="mr-1"
                      >
                        Choose file
                      </Button>
                      or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      PNG, JPG up to 8MB
                    </p>
                  </div>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleInputChange}
                className="hidden"
              />
            </>
          )}

          {/* Cancel button */}
          {onCancel && (
            <div className="mt-4">
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={processing}
              >
                Cancel
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
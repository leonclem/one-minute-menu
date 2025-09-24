'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onCancel: () => void
  className?: string
}

export default function CameraCapture({ onCapture, onCancel, className = '' }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      setError(null)
      
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setIsStreaming(true)
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setError('Unable to access camera. Please check permissions and try again.')
    }
  }, [facingMode])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setIsStreaming(false)
  }, [])

  // Capture photo
  const capturePhoto = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    
    if (!video || !canvas) return

    const context = canvas.getContext('2d')
    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to blob and create file
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `menu-photo-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        })
        
        stopCamera()
        onCapture(file)
      }
    }, 'image/jpeg', 0.8)
  }, [onCapture, stopCamera])

  // Switch camera (front/back)
  const switchCamera = useCallback(() => {
    stopCamera()
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user')
  }, [stopCamera])

  // Handle cancel
  const handleCancel = useCallback(() => {
    stopCamera()
    onCancel()
  }, [stopCamera, onCancel])

  // Start camera on mount
  useEffect(() => {
    startCamera()
    return () => stopCamera()
  }, [startCamera, stopCamera])

  // Restart camera when facing mode changes
  useEffect(() => {
    if (isStreaming) {
      startCamera()
    }
  }, [facingMode, startCamera, isStreaming])

  return (
    <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
      {/* Video Stream */}
      <video
        ref={videoRef}
        className="w-full h-full object-cover"
        playsInline
        muted
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
      />
      
      {/* Hidden canvas for capture */}
      <canvas ref={canvasRef} className="hidden" />
      
      {/* Camera overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Viewfinder guide */}
        <div className="absolute inset-4 border-2 border-white border-opacity-50 rounded-lg">
          <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white"></div>
          <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white"></div>
          <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white"></div>
          <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white"></div>
        </div>
        
        {/* Instructions */}
        <div className="absolute top-4 left-4 right-4">
          <div className="bg-black bg-opacity-50 text-white text-sm px-3 py-2 rounded-lg text-center">
            Position your menu within the frame
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
        <div className="flex items-center justify-between">
          {/* Cancel button */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            className="bg-black bg-opacity-50 text-white border-white border-opacity-50 hover:bg-opacity-70"
          >
            Cancel
          </Button>

          {/* Capture button */}
          <button
            onClick={capturePhoto}
            disabled={!isStreaming}
            className="w-16 h-16 bg-white rounded-full border-4 border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Capture photo"
          >
            <div className="w-full h-full bg-white rounded-full"></div>
          </button>

          {/* Switch camera button */}
          <Button
            variant="outline"
            size="sm"
            onClick={switchCamera}
            disabled={!isStreaming}
            className="bg-black bg-opacity-50 text-white border-white border-opacity-50 hover:bg-opacity-70"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm text-center">
            <div className="text-red-600 mb-2">
              <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Camera Error</h3>
            <p className="text-sm text-gray-600 mb-4">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={startCamera}>
                Retry
              </Button>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {!isStreaming && !error && (
        <div className="absolute inset-0 bg-black flex items-center justify-center">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-sm">Starting camera...</p>
          </div>
        </div>
      )}
    </div>
  )
}
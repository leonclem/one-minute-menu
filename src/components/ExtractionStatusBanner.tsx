'use client'

import { AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react'

interface ExtractionStatusBannerProps {
  status: 'idle' | 'uploading' | 'submitting' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export default function ExtractionStatusBanner({ status, message, progress }: ExtractionStatusBannerProps) {
  if (status === 'idle') return null

  const getStatusConfig = () => {
    switch (status) {
      case 'uploading':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-ux-primary" />,
          title: 'Uploading image...',
          bg: 'bg-[#F0FDFD]',
          border: 'border-ux-primary/20',
          textColor: 'text-ux-primary-dark'
        }
      case 'submitting':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-ux-primary" />,
          title: 'Starting extraction...',
          bg: 'bg-[#F0FDFD]',
          border: 'border-ux-primary/20',
          textColor: 'text-ux-primary-dark'
        }
      case 'processing':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-ux-primary" />,
          title: 'AI is processing your menu...',
          description: 'This usually takes ~15-30 seconds. Please don\'t close this page.',
          bg: 'bg-[#F0FDFD]',
          border: 'border-ux-primary/20',
          textColor: 'text-ux-primary-dark'
        }
      case 'completed':
        return {
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
          title: 'Extraction complete!',
          bg: 'bg-green-50',
          border: 'border-green-200',
          textColor: 'text-green-800'
        }
      case 'failed':
        return {
          icon: <AlertCircle className="h-5 w-5 text-red-500" />,
          title: 'Extraction failed',
          bg: 'bg-red-50',
          border: 'border-red-200',
          textColor: 'text-red-800'
        }
      default:
        return {
          icon: <Info className="h-5 w-5 text-gray-500" />,
          title: 'Processing...',
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          textColor: 'text-gray-800'
        }
    }
  }

  const config = getStatusConfig()

  return (
    <div className={`mb-6 p-4 rounded-xl border ${config.bg} ${config.border} shadow-sm transition-all animate-in fade-in slide-in-from-top-4`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{config.icon}</div>
        <div className="flex-1">
          <h3 className={`font-semibold ${config.textColor}`}>
            {config.title}
          </h3>
          {(message || (config as any).description) && (
            <p className={`mt-1 text-sm opacity-90 ${config.textColor}`}>
              {message || (config as any).description}
            </p>
          )}
          {status === 'processing' && progress !== undefined && (
            <div className="mt-3 w-full bg-blue-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-ux-primary h-full transition-all duration-500" 
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

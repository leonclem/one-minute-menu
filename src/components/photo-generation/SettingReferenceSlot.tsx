'use client'

import { useState } from 'react'
import { Image as ImageIcon } from 'lucide-react'
import ImageUpload from '@/components/ImageUpload'
import { processImage } from '@/lib/image-utils'
import { useToast } from '@/components/ui'

interface SettingReferenceSlotProps {
  value?: string // dataUrl
  onChange: (dataUrl?: string) => void
  disabled?: boolean
}

export default function SettingReferenceSlot({ value, onChange, disabled }: SettingReferenceSlotProps) {
  const [showUpload, setShowUpload] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const { showToast } = useToast()

  const handleUpload = async (file: File, previewUrl: string) => {
    try {
      const processed = await processImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 })
      onChange(processed.dataUrl)
      setPreview(previewUrl)
      setShowUpload(false)
    } catch (e) {
      showToast({ type: 'error', title: 'Upload failed', description: 'Could not process image.' })
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-secondary-900 uppercase tracking-wider">3. Background Setting</h3>
        {value && !disabled && (
          <button 
            type="button"
            onClick={() => {
              onChange(undefined)
              setPreview(null)
            }}
            className="text-[10px] font-bold text-red-500 uppercase hover:underline"
          >
            Remove
          </button>
        )}
      </div>
      
      {!value ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setShowUpload(true)}
          className={`w-full p-8 rounded-2xl border-2 border-dashed border-secondary-200 hover:border-[#01B3BF] hover:bg-[#01B3BF]/5 transition-all group flex flex-col items-center gap-3 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <div className="p-4 bg-secondary-50 rounded-full text-secondary-400 group-hover:bg-white group-hover:text-[#01B3BF] transition-colors">
            <ImageIcon className="w-8 h-8" />
          </div>
          <div className="text-center">
            <div className="font-bold text-secondary-900">Use my venue/table</div>
            <p className="text-xs text-secondary-400 mt-1 max-w-[280px]">
              Upload a photo of your restaurant or dining area to set the background.
            </p>
          </div>
        </button>
      ) : (
        <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-[#01B3BF] shadow-lg">
          <img src={preview || value} alt="Setting" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-4">
            <div className="text-white">
              <div className="font-bold text-sm">Setting Reference Active</div>
              <p className="text-[10px] opacity-80">The AI will place your dish into this scene.</p>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-lg">
            <ImageUpload
              onImageSelected={handleUpload}
              onCancel={() => setShowUpload(false)}
              primaryUploadLabel="Upload Venue Photo"
              uploadButtonVariant="primary"
            />
          </div>
        </div>
      )}
    </section>
  )
}

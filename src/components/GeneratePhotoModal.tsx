'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { X, Sparkles, Camera, Zap, Sun, Moon, Monitor, Image as ImageIcon } from 'lucide-react'
import type { PhotoGenerationParams, QuotaStatus } from '@/types'
import { Button } from '@/components/ui'
import { useToast } from '@/components/ui'
import ImageUpload from '@/components/ImageUpload'
import { processImage } from '@/lib/image-utils'

import AngleSelector from './photo-generation/AngleSelector'
import LightingSelector from './photo-generation/LightingSelector'
import SettingReferenceSlot from './photo-generation/SettingReferenceSlot'

interface GeneratePhotoModalProps {
  itemId: string
  menuId: string
  itemName: string
  itemDescription?: string
  onClose: () => void
  onSuccess: () => void
}

export default function GeneratePhotoModal({
  itemId,
  menuId,
  itemName,
  itemDescription,
  onClose,
  onSuccess
}: GeneratePhotoModalProps) {
  const [generating, setGenerating] = useState(false)
  const [params, setParams] = useState<PhotoGenerationParams>({
    angle: '45',
    lighting: 'natural',
    resolution: '1k'
  })
  const [quota, setQuota] = useState<QuotaStatus | null>(null)
  const [settingPreview, setSettingPreview] = useState<string | null>(null)
  const [showSettingUpload, setShowSettingUpload] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    const loadQuota = async () => {
      try {
        const res = await fetch('/api/quota')
        const json = await res.json()
        if (res.ok && json.success) {
          // The API returns { quota: { remaining, limit, plan }, usage: ... }
          setQuota(json.data.quota)
        }
      } catch (e) {
        console.error('Failed to load quota', e)
      }
    }
    loadQuota()
  }, [])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          menuId,
          menuItemId: itemId,
          styleParams: {
            angle: params.angle,
            lighting: params.lighting,
            resolution: params.resolution,
            // Map to legacy fields for now to keep API working until Phase 4
            presentation: params.angle === 'overhead' ? 'overhead' : params.angle === 'front' ? 'closeup' : 'white_plate'
          },
          referenceImages: params.settingReferenceImage ? [{
            dataUrl: params.settingReferenceImage,
            role: 'scene',
            name: 'Setting'
          }] : []
        }),
      })

      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Generation failed')

      const jobId = result.data?.jobId as string | undefined
      if (jobId) {
        showToast({
          type: 'info',
          title: 'Generation started',
          description: 'Your photo is being created. This can take a minute.',
        })
        const maxPolls = 120
        const delayMs = 2000
        for (let i = 0; i < maxPolls; i++) {
          await new Promise(r => setTimeout(r, delayMs))
          const statusRes = await fetch(`/api/generation-jobs/${jobId}`)
          const statusJson = await statusRes.json()
          if (!statusRes.ok) {
            throw new Error(statusJson?.error || 'Failed to check generation status')
          }
          const job = statusJson.data?.job
          if (!job) continue
          if (job.status === 'failed') {
            throw new Error(job.errorMessage || 'Generation failed')
          }
          if (job.status === 'completed') {
            showToast({
              type: 'success',
              title: 'Photo generated!',
              description: 'Your new food photo is ready.',
            })
            onSuccess()
            return
          }
        }
        throw new Error('Generation is taking longer than expected. Check back shortly.')
      }

      if (result.data?.images?.length) {
        showToast({
          type: 'success',
          title: 'Photo generated!',
          description: 'Your new food photo is ready.',
        })
        onSuccess()
        return
      }

      throw new Error('Unexpected response from server')
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Generation failed',
        description: e.message
      })
    } finally {
      setGenerating(false)
    }
  }

  const handleSettingUpload = async (file: File, preview: string) => {
    try {
      // Resize for API safety
      const processed = await processImage(file, { maxWidth: 1024, maxHeight: 1024, quality: 0.8 })
      setParams(prev => ({ ...prev, settingReferenceImage: processed.dataUrl }))
      setSettingPreview(preview)
      setShowSettingUpload(false)
    } catch (e) {
      showToast({ type: 'error', title: 'Upload failed', description: 'Could not process image.' })
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-5 border-b border-secondary-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-secondary-900 truncate">{itemName}</h2>
            <p className="text-sm text-secondary-500 line-clamp-1 mt-0.5">Configure your AI photo</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generating || !!(quota && quota.remaining <= 0)}
              className="rounded-full px-6 bg-[#01B3BF] hover:bg-[#01B3BF]/90"
            >
              {generating ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full" />
                  <span>Creating...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  <span>Generate</span>
                </div>
              )}
            </Button>
            <button 
              onClick={onClose}
              className="p-2 text-secondary-400 hover:text-secondary-600 hover:bg-secondary-50 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Angle Section */}
          <AngleSelector 
            selected={params.angle} 
            onChange={(angle) => setParams(prev => ({ ...prev, angle }))} 
            disabled={generating}
          />

          {/* Lighting Section */}
          <LightingSelector 
            selected={params.lighting} 
            onChange={(lighting) => setParams(prev => ({ ...prev, lighting }))} 
            disabled={generating}
          />

          {/* Setting Reference Section */}
          <SettingReferenceSlot 
            value={params.settingReferenceImage} 
            onChange={(dataUrl) => setParams(prev => ({ ...prev, settingReferenceImage: dataUrl }))} 
            disabled={generating}
          />

          {/* Resolution Toggle */}
          <section className="pt-4 border-t border-secondary-100 flex items-center justify-between">
            <div className="flex-1 pr-4">
              <h3 className="text-sm font-bold text-secondary-900 uppercase tracking-wider">Resolution</h3>
              <p className="text-[10px] text-secondary-400 font-medium uppercase mt-1">
                {params.resolution === '4k' 
                  ? 'Ultra-high definition (4K) enabled' 
                  : 'High-definition (1K) output'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex bg-secondary-100 p-1 rounded-xl">
                {['1k', '4k'].map((res) => {
                  const is4k = res === '4k';
                  const isLocked = is4k && quota?.plan === 'free';
                  
                  return (
                    <button
                      key={res}
                      disabled={isLocked || generating}
                      onClick={() => setParams(prev => ({ ...prev, resolution: res as any }))}
                      className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        params.resolution === res 
                          ? 'bg-white text-secondary-900 shadow-sm' 
                          : isLocked
                            ? 'text-secondary-300 cursor-not-allowed'
                            : 'text-secondary-400 hover:text-secondary-600'
                      }`}
                    >
                      {res.toUpperCase()}
                      {isLocked && <Zap className="w-3 h-3 fill-secondary-300 text-secondary-300" />}
                    </button>
                  );
                })}
              </div>
              {quota?.plan === 'free' && (
                <Link
                  href="/pricing"
                  className="text-[9px] text-secondary-400 font-bold uppercase tracking-tight hover:text-secondary-600 transition-colors"
                >
                  Upgrade for <span className="text-[#F8BC02]">4K Resolution</span>
                </Link>
              )}
            </div>
          </section>
        </div>

        {/* Footer Quota */}
        <div className="px-6 py-4 bg-secondary-50 border-t border-secondary-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${quota ? 'bg-[#01B3BF]' : 'bg-secondary-300'}`} />
            <p className="text-[10px] text-secondary-500 uppercase font-bold tracking-widest">
              {quota ? `${quota.remaining} generations remaining` : 'Syncing quota...'}
            </p>
          </div>
        </div>
      </div>

      {showSettingUpload && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="w-full max-w-lg">
            <ImageUpload
              onImageSelected={handleSettingUpload}
              onCancel={() => setShowSettingUpload(false)}
              primaryUploadLabel="Upload Venue Photo"
              uploadButtonVariant="primary"
            />
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

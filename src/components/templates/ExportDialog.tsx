'use client'

import { useState } from 'react'
import type { CategoryV2, ExportFormat, PageSize, ExportJob } from '@/types/templates'
import { PreflightPanel } from './PreflightPanel'

export interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  menuId: string
  templateId: string
  menuData: { categories: CategoryV2[] }
}

type ExportStep = 'preflight' | 'options' | 'exporting' | 'complete'

export function ExportDialog({
  isOpen,
  onClose,
  menuId,
  templateId,
  menuData,
}: ExportDialogProps) {
  const [step, setStep] = useState<ExportStep>('preflight')
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [pageSize, setPageSize] = useState<PageSize>('A4')
  const [dpi, setDpi] = useState<number>(300)
  const [filename, setFilename] = useState<string>('menu')
  const [exportJob, setExportJob] = useState<ExportJob | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handlePreflightProceed = () => {
    setStep('options')
  }

  const handlePreflightCancel = () => {
    onClose()
  }

  const handleExport = async () => {
    try {
      setStep('exporting')
      setError(null)

      // Start export job
      const response = await fetch('/api/templates/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          menuId,
          templateId,
          format,
          options: {
            filename,
            pageSize: format === 'pdf' ? pageSize : undefined,
            dpi: format === 'png' ? dpi : undefined,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start export')
      }

      const data = await response.json()
      setExportJob(data.job)

      // Poll for completion
      await pollExportStatus(data.job.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
      setStep('options')
    }
  }

  const pollExportStatus = async (jobId: string) => {
    const maxAttempts = 60 // 60 seconds max
    let attempts = 0

    const poll = async () => {
      try {
        const response = await fetch(`/api/templates/export/${jobId}`)
        if (!response.ok) {
          throw new Error('Failed to check export status')
        }

        const data = await response.json()
        setExportJob(data.job)

        if (data.job.status === 'completed') {
          setDownloadUrl(data.job.result.url)
          setStep('complete')
        } else if (data.job.status === 'failed') {
          throw new Error(data.job.errorMessage || 'Export failed')
        } else if (attempts < maxAttempts) {
          attempts++
          setTimeout(poll, 1000)
        } else {
          throw new Error('Export timed out')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Export failed')
        setStep('options')
      }
    }

    poll()
  }

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank')
    }
  }

  const handleReset = () => {
    setStep('preflight')
    setExportJob(null)
    setDownloadUrl(null)
    setError(null)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="relative max-w-2xl w-full">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-2 -right-2 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100 transition-colors"
        >
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Preflight Step */}
        {step === 'preflight' && (
          <PreflightPanel
            menuData={menuData}
            onProceed={handlePreflightProceed}
            onCancel={handlePreflightCancel}
          />
        )}

        {/* Export Options Step */}
        {step === 'options' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Export Options
              </h3>
            </div>

            <div className="px-6 py-4 space-y-6">
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Format Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Export Format
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['pdf', 'png', 'html'] as ExportFormat[]).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setFormat(fmt)}
                      className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                        format === fmt
                          ? 'border-blue-600 bg-blue-50 text-blue-900'
                          : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                      }`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* PDF Options */}
              {format === 'pdf' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Page Size
                  </label>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(e.target.value as PageSize)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="A4">A4</option>
                    <option value="US_LETTER">US Letter</option>
                    <option value="TABLOID">Tabloid</option>
                  </select>
                </div>
              )}

              {/* PNG Options */}
              {format === 'png' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    DPI (Resolution)
                  </label>
                  <select
                    value={dpi}
                    onChange={(e) => setDpi(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={150}>150 DPI (Draft)</option>
                    <option value={300}>300 DPI (Standard)</option>
                    <option value={600}>600 DPI (High Quality)</option>
                  </select>
                </div>
              )}

              {/* Filename */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Filename
                </label>
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="menu"
                />
                <p className="text-xs text-gray-500">
                  File extension will be added automatically
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setStep('preflight')}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleExport}
                className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Export
              </button>
            </div>
          </div>
        )}

        {/* Exporting Step */}
        {step === 'exporting' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-lg p-8">
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
              <h3 className="text-lg font-semibold text-gray-900">
                Exporting your menu...
              </h3>
              <p className="text-sm text-gray-600 text-center">
                {exportJob?.status === 'processing'
                  ? 'Generating your export file'
                  : 'Preparing export'}
              </p>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Export Complete!
              </h3>
            </div>

            <div className="px-6 py-8">
              <div className="flex flex-col items-center justify-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <p className="text-gray-700">
                  Your menu has been exported successfully
                </p>
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Download File
                </button>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Export Another
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

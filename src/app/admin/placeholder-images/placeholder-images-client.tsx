'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

interface ImageStatus {
  hasPhoto: boolean
  hasCutout: boolean
  photoUrl?: string
  cutoutUrl?: string
}

interface ItemDetails {
  itemName: string
  description: string
  category: string
  cuisine: string
  establishmentType: string
}

interface ImageEntry {
  suggested_image_key: string
  cuisine: string
  image_archetype: string
  representative_item: string
  image_priority: string
  generate_now: boolean
  mapped_items: string
  generation_prompt: string
  itemDetails: ItemDetails | null
  status: ImageStatus
}

interface Summary {
  total: number
  withPhoto: number
  withCutout: number
  missing: number
}

type GenerationStatus = 'idle' | 'generating' | 'completed' | 'failed'
type CutoutRetryStatus = 'idle' | 'retrying' | 'completed' | 'failed'

interface ItemGenerationState {
  status: GenerationStatus
  error?: string
  photoUrl?: string
}

interface ItemCutoutRetryState {
  status: CutoutRetryStatus
  error?: string
  cutoutUrl?: string
}

interface PreviewImage {
  key: string
  label: string
  photoUrl?: string
  cutoutUrl?: string
}

const CUISINE_ORDER = [
  'Chinese', 'Indian', 'Italian', 'Japanese', 'Korean',
  'Local (SG/Malay/Chinese/Indian)', 'Mexican', 'Other',
  'Peranakan / Nyonya', 'Thai / Vietnamese', 'Western / Fusion',
]

export function PlaceholderImageManagerClient() {
  const [entries, setEntries] = useState<ImageEntry[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Generation state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [generationState, setGenerationState] = useState<Record<string, ItemGenerationState>>({})
  const [cutoutRetryState, setCutoutRetryState] = useState<Record<string, ItemCutoutRetryState>>({})
  const [batchRunning, setBatchRunning] = useState(false)

  // Filters
  const [cuisineFilter, setCuisineFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'missing' | 'generated'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'P1' | 'P2' | 'P3'>('all')

  // Detail expansion + image preview modal
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const resp = await fetch('/api/admin/placeholder-images')
      const json = await resp.json()
      if (!resp.ok || !json.success) throw new Error(json.error || 'Failed to load')
      setEntries(json.data.entries)
      setSummary(json.data.summary)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Group entries by cuisine
  const cuisines = useMemo(() => {
    const groups: Record<string, ImageEntry[]> = {}
    for (const entry of entries) {
      const c = entry.cuisine
      if (!groups[c]) groups[c] = []
      groups[c].push(entry)
    }
    return CUISINE_ORDER
      .filter(c => groups[c])
      .map(c => ({ cuisine: c, items: groups[c] }))
  }, [entries])

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (cuisineFilter !== 'all' && e.cuisine !== cuisineFilter) return false
      if (statusFilter === 'missing' && e.status.hasPhoto) return false
      if (statusFilter === 'generated' && !e.status.hasPhoto) return false
      if (priorityFilter !== 'all' && e.image_priority !== priorityFilter) return false
      return true
    })
  }, [entries, cuisineFilter, statusFilter, priorityFilter])

  // Grouped filtered entries
  const groupedFiltered = useMemo(() => {
    const groups: Record<string, ImageEntry[]> = {}
    for (const entry of filteredEntries) {
      const c = entry.cuisine
      if (!groups[c]) groups[c] = []
      groups[c].push(entry)
    }
    return CUISINE_ORDER
      .filter(c => groups[c])
      .map(c => ({ cuisine: c, items: groups[c] }))
  }, [filteredEntries])

  const toggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectAll = () => {
    setSelectedKeys(new Set(filteredEntries.map(e => e.suggested_image_key)))
  }

  const selectMissing = () => {
    setSelectedKeys(new Set(filteredEntries.filter(e => !e.status.hasPhoto).map(e => e.suggested_image_key)))
  }

  const clearSelection = () => setSelectedKeys(new Set())

  // Poll a job until completion or failure, then wait briefly for cutout
  const pollJob = async (
    jobId: string,
    menuItemId: string,
    maxPolls = 90,
    delayMs = 2000,
  ): Promise<{ completed: boolean; imageUrl?: string; webpUrl?: string; cutoutUrl?: string }> => {
    let imageUrl: string | undefined
    let webpUrl: string | undefined
    let imageId: string | undefined

    // Phase 1: wait for generation to complete
    for (let i = 0; i < maxPolls; i++) {
      await new Promise(r => setTimeout(r, delayMs))
      try {
        const resp = await fetch(`/api/generation-jobs/${jobId}`)
        const json = await resp.json()
        if (!resp.ok) continue
        const job = json?.data?.job
        const images = json?.data?.images ?? []
        if (job?.status === 'completed' && images.length > 0) {
          imageUrl = images[0]?.originalUrl
          webpUrl = images[0]?.webpUrl
          imageId = images[0]?.id
          break
        }
        if (job?.status === 'failed') {
          return { completed: false }
        }
      } catch { /* continue polling */ }
    }

    if (!imageUrl) return { completed: false }

    // Phase 2: wait briefly for cutout to appear (up to 30s)
    let cutoutUrl: string | undefined
    if (imageId) {
      for (let i = 0; i < 15; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          const resp = await fetch(`/api/admin/placeholder-images/cutout-status?imageId=${imageId}`)
          const json = await resp.json()
          if (json?.data?.cutoutUrl) {
            cutoutUrl = json.data.cutoutUrl
            break
          }
          if (json?.data?.status === 'failed' || json?.data?.status === 'not_requested') {
            break
          }
        } catch { /* continue */ }
      }
    }

    return { completed: true, imageUrl, webpUrl, cutoutUrl }
  }

  // Enqueue generation for a single image key and poll until done
  const generateOne = async (key: string) => {
    setGenerationState(prev => ({
      ...prev,
      [key]: { status: 'generating' },
    }))

    try {
      // 1. Enqueue the job
      const entry = entries.find(e => e.suggested_image_key === key)
      const resp = await fetch('/api/admin/placeholder-images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageKey: key,
          cuisine: entry?.cuisine,
        }),
      })
      const json = await resp.json()

      if (!resp.ok || !json.success) {
        setGenerationState(prev => ({
          ...prev,
          [key]: { status: 'failed', error: json.error || 'Enqueue failed' },
        }))
        return false
      }

      // 2. Poll the worker job until completion (including cutout)
      const { completed, webpUrl, imageUrl, cutoutUrl } = await pollJob(
        json.data.jobId,
        json.data.menuItemId,
      )

      if (!completed) {
        setGenerationState(prev => ({
          ...prev,
          [key]: { status: 'failed', error: 'Generation timed out or failed' },
        }))
        return false
      }

      // 3. Copy the generated image (and cutout) to the placeholder storage path
      const sourceUrl = webpUrl || imageUrl!
      const copyResp = await fetch('/api/admin/placeholder-images/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageKey: key, sourceUrl, cutoutUrl }),
      })
      const copyJson = await copyResp.json()

      if (!copyResp.ok || !copyJson.success) {
        setGenerationState(prev => ({
          ...prev,
          [key]: { status: 'failed', error: copyJson?.error || 'Copy to placeholder storage failed' },
        }))
        return false
      }

      const finalUrl = copyJson.data.photoUrl

      setGenerationState(prev => ({
        ...prev,
        [key]: { status: 'completed', photoUrl: finalUrl },
      }))

      setEntries(prev => prev.map(e =>
        e.suggested_image_key === key
          ? {
              ...e,
              status: {
                ...e.status,
                hasPhoto: true,
                photoUrl: finalUrl,
                hasCutout: !!copyJson.data.cutoutUrl,
                cutoutUrl: copyJson.data.cutoutUrl,
              },
            }
          : e
      ))
      // Uncheck the item now that generation has completed
      setSelectedKeys(prev => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      return true
    } catch {
      setGenerationState(prev => ({
        ...prev,
        [key]: { status: 'failed', error: 'Network error' },
      }))
      return false
    }
  }

  // Retry cutout generation for an item that has a photo but no cutout
  const retryCutout = async (key: string) => {
    setCutoutRetryState(prev => ({ ...prev, [key]: { status: 'retrying' } }))

    try {
      const resp = await fetch('/api/admin/placeholder-images/retry-cutout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageKey: key }),
      })
      const json = await resp.json()

      if (!resp.ok || !json.success) {
        setCutoutRetryState(prev => ({
          ...prev,
          [key]: { status: 'failed', error: json.error || 'Cutout retry failed' },
        }))
        return
      }

      const cutoutUrl = json.data.cutoutUrl
      setCutoutRetryState(prev => ({ ...prev, [key]: { status: 'completed', cutoutUrl } }))
      setEntries(prev => prev.map(e =>
        e.suggested_image_key === key
          ? { ...e, status: { ...e.status, hasCutout: true, cutoutUrl } }
          : e
      ))
    } catch {
      setCutoutRetryState(prev => ({
        ...prev,
        [key]: { status: 'failed', error: 'Network error' },
      }))
    }
  }

  // Batch generate selected items
  const runBatch = async () => {
    if (selectedKeys.size === 0) return
    setBatchRunning(true)

    const keys = Array.from(selectedKeys)
    let completed = 0
    let failed = 0

    for (const key of keys) {
      const success = await generateOne(key)
      if (success) completed++
      else failed++

      if (keys.indexOf(key) < keys.length - 1) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }

    setBatchRunning(false)
    await loadData()
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-64 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
          <button onClick={loadData} className="mt-2 text-sm text-red-600 underline">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Image preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="bg-white rounded-xl shadow-2xl max-w-3xl w-full mx-4 overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div>
                <h3 className="font-semibold text-gray-900">{previewImage.label}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{previewImage.key}</p>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className={`grid ${previewImage.cutoutUrl ? 'grid-cols-2' : 'grid-cols-1'} gap-6`}>
                {/* Photo */}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-2">Photo</p>
                  {previewImage.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewImage.photoUrl}
                      alt={`${previewImage.label} - photo`}
                      className="w-full rounded-lg border"
                    />
                  ) : (
                    <div className="w-full aspect-square bg-gray-100 rounded-lg flex items-center justify-center">
                      <span className="text-gray-400 text-sm">No photo</span>
                    </div>
                  )}
                </div>

                {/* Cutout */}
                {previewImage.cutoutUrl && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">Cutout</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImage.cutoutUrl}
                      alt={`${previewImage.label} - cutout`}
                      className="w-full rounded-lg"
                      style={{ background: 'repeating-conic-gradient(#e5e7eb 0% 25%, transparent 0% 50%) 50% / 16px 16px' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Placeholder Image Manager</h1>
          <p className="text-sm text-gray-500 mt-1">
            Generate and manage sample menu item images for the onboarding preview system.
          </p>
        </div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">
          &larr; Admin Hub
        </a>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SummaryCard label="Total" value={summary.total} />
          <SummaryCard label="Generated" value={summary.withPhoto} variant="success" />
          <SummaryCard label="With cutout" value={summary.withCutout} variant="info" />
          <SummaryCard label="Missing" value={summary.missing} variant={summary.missing > 0 ? 'warning' : 'success'} />
        </div>
      )}

      {/* Filters */}
      <div className="bg-white border rounded-lg p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Cuisine</label>
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={cuisineFilter}
            onChange={e => setCuisineFilter(e.target.value)}
          >
            <option value="all">All cuisines</option>
            {CUISINE_ORDER.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="missing">Missing</option>
            <option value="generated">Generated</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
          <select
            className="border rounded px-3 py-1.5 text-sm"
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="P1">P1 (generate now)</option>
            <option value="P2">P2 (later)</option>
            <option value="P3">P3 (text only OK)</option>
          </select>
        </div>

        <div className="ml-auto flex items-end gap-2">
          <button onClick={selectAll} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">
            Select all ({filteredEntries.length})
          </button>
          <button onClick={selectMissing} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">
            Select missing ({filteredEntries.filter(e => !e.status.hasPhoto).length})
          </button>
          <button onClick={clearSelection} className="px-3 py-1.5 text-xs border rounded hover:bg-gray-50">
            Clear
          </button>
        </div>
      </div>

      {/* Batch action bar */}
      {selectedKeys.size > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-sm font-medium text-amber-800">
            {selectedKeys.size} image{selectedKeys.size > 1 ? 's' : ''} selected
          </span>
          <button
            onClick={runBatch}
            disabled={batchRunning}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {batchRunning ? 'Generating...' : `Generate ${selectedKeys.size} image${selectedKeys.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Image list grouped by cuisine */}
      <div className="space-y-6">
        {groupedFiltered.map(({ cuisine, items }) => (
          <div key={cuisine} className="bg-white border rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700">{cuisine}</h2>
              <span className="text-xs text-gray-500">
                {items.filter(i => i.status.hasPhoto).length}/{items.length} generated
              </span>
            </div>

            <div className="divide-y">
              {items.map(entry => {
                const key = entry.suggested_image_key
                const genState = generationState[key]
                const isSelected = selectedKeys.has(key)
                const isExpanded = expandedKey === key
                const photoUrl = genState?.photoUrl || entry.status.photoUrl
                const hasAnyImage = !!(photoUrl || entry.status.cutoutUrl)

                return (
                  <div
                    key={key}
                    className={`px-4 py-3 flex items-start gap-4 transition-colors ${
                      isSelected ? 'bg-amber-50/50' : 'hover:bg-gray-50'
                    }`}
                  >
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleKey(key)}
                      className="mt-1 h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
                    />

                    {/* Clickable thumbnail */}
                    <button
                      className="w-16 h-16 rounded-lg bg-gray-100 border overflow-hidden flex-shrink-0 flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-amber-300 transition-all disabled:cursor-default"
                      disabled={!hasAnyImage}
                      onClick={() => {
                        if (hasAnyImage) {
                          setPreviewImage({
                            key,
                            label: entry.representative_item,
                            photoUrl,
                            cutoutUrl: entry.status.cutoutUrl,
                          })
                        }
                      }}
                    >
                      {photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrl}
                          alt={entry.representative_item}
                          className="w-full h-full object-cover"
                        />
                      ) : genState?.status === 'generating' ? (
                        <div className="w-5 h-5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm text-gray-900">{entry.representative_item}</span>
                        <PriorityBadge priority={entry.image_priority} />
                        <span className="text-xs text-gray-400">{entry.image_archetype}</span>
                      </div>
                      <p className="text-xs text-gray-500 truncate" title={entry.mapped_items}>
                        Maps to: {entry.mapped_items}
                      </p>

                      {/* Item details from Item Matrix */}
                      {entry.itemDetails ? (
                        <p
                          className="text-xs text-gray-400 mt-1 truncate cursor-pointer hover:text-gray-600"
                          title="Click to expand"
                          onClick={() => setExpandedKey(isExpanded ? null : key)}
                        >
                          {entry.itemDetails.category} &middot; {entry.itemDetails.description}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-1 italic">No item matrix data found</p>
                      )}
                      {isExpanded && entry.itemDetails && (
                        <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-1">
                          <p><span className="font-medium text-gray-600">Name:</span> {entry.itemDetails.itemName}</p>
                          <p><span className="font-medium text-gray-600">Description:</span> {entry.itemDetails.description}</p>
                          <p><span className="font-medium text-gray-600">Category:</span> {entry.itemDetails.category}</p>
                          <p><span className="font-medium text-gray-600">Cuisine:</span> {entry.itemDetails.cuisine}</p>
                          <p><span className="font-medium text-gray-600">Establishment:</span> {entry.itemDetails.establishmentType}</p>
                          <p className="text-gray-400 italic">Prompt built by PromptConstructionService at generation time</p>
                        </div>
                      )}

                      {/* Error message */}
                      {genState?.status === 'failed' && genState.error && (
                        <p className="text-xs text-red-600 mt-1">{genState.error}</p>
                      )}
                    </div>

                    {/* Status + actions */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {/* Cutout indicator */}
                      {entry.status.hasCutout ? (
                        <button
                          className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-800"
                          title="View cutout"
                          onClick={() => setPreviewImage({
                            key,
                            label: entry.representative_item,
                            photoUrl,
                            cutoutUrl: entry.status.cutoutUrl,
                          })}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Cutout
                        </button>
                      ) : entry.status.hasPhoto ? (
                        (() => {
                          const retryState = cutoutRetryState[key]
                          if (retryState?.status === 'retrying') {
                            return (
                              <span className="flex items-center gap-1 text-[10px] text-amber-600">
                                <div className="w-2.5 h-2.5 border border-amber-400 border-t-transparent rounded-full animate-spin" />
                                Retrying…
                              </span>
                            )
                          }
                          if (retryState?.status === 'failed') {
                            return (
                              <button
                                className="text-[10px] text-red-500 hover:text-red-700 underline"
                                title={retryState.error || 'Cutout failed — click to retry'}
                                onClick={() => retryCutout(key)}
                              >
                                Cutout failed
                              </button>
                            )
                          }
                          return (
                            <button
                              className="text-[10px] text-gray-400 hover:text-amber-600 hover:underline transition-colors"
                              title="Cutout missing — click to retry"
                              onClick={() => retryCutout(key)}
                            >
                              No cutout
                            </button>
                          )
                        })()
                      ) : null}

                      {entry.status.hasPhoto ? (
                        <StatusBadge status="done" />
                      ) : genState?.status === 'generating' ? (
                        <StatusBadge status="generating" />
                      ) : genState?.status === 'completed' ? (
                        <StatusBadge status="done" />
                      ) : genState?.status === 'failed' ? (
                        <StatusBadge status="failed" />
                      ) : (
                        <StatusBadge status="pending" />
                      )}

                      <button
                        onClick={() => generateOne(key)}
                        disabled={genState?.status === 'generating' || batchRunning}
                        className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={entry.status.hasPhoto ? 'Regenerate' : 'Generate'}
                      >
                        {entry.status.hasPhoto ? 'Regen' : 'Generate'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          No items match your filters.
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value, variant = 'default' }: {
  label: string
  value: number
  variant?: 'default' | 'success' | 'warning' | 'info'
}) {
  const colors = {
    default: 'bg-white border-gray-200 text-gray-900',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  }
  return (
    <div className={`border rounded-lg px-4 py-3 ${colors[variant]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium opacity-75">{label}</div>
    </div>
  )
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    P1: 'bg-red-100 text-red-700',
    P2: 'bg-yellow-100 text-yellow-700',
    P3: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${colors[priority] || 'bg-gray-100 text-gray-500'}`}>
      {priority}
    </span>
  )
}

function StatusBadge({ status }: { status: 'done' | 'generating' | 'failed' | 'pending' }) {
  const config = {
    done: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Done' },
    generating: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Generating' },
    failed: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
    pending: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Pending' },
  }
  const c = config[status]
  return (
    <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

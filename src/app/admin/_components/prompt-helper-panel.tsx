'use client'

import { useEffect, useMemo, useState } from 'react'
import type { ReferenceMode, PromptHelperValues } from './prompt-helper'
import { buildPromptHelperText } from './prompt-helper'
import { PROMPT_PRESETS } from './prompt-presets'

type SavedPreset = {
  id: string
  name: string
  description?: string | null
  mode: ReferenceMode
  scenarioId?: string | null
  helperValues: Record<string, any>
  prompt: string
  createdAt?: string
}

export function PromptHelperPanel({
  mode,
  onScenarioChange,
  currentPrompt,
  onReplacePrompt,
  onAppend,
  onReplace,
}: {
  mode: ReferenceMode
  onScenarioChange: (scenarioId: string | null) => void
  currentPrompt: string
  onReplacePrompt: (prompt: string) => void
  onAppend: (text: string) => void
  onReplace: (text: string) => void
}) {
  const [values, setValues] = useState<PromptHelperValues>({
    cameraAngle: 'three_quarter',
    lighting: 'natural_soft',
    background: 'restaurant_table',
    platingStyle: 'clean, modern plating on a white plate',
  })
  const [selectedPresetId, setSelectedPresetId] = useState<string>('') // empty = custom
  const [savedPresets, setSavedPresets] = useState<SavedPreset[]>([])
  const [selectedSavedPresetId, setSelectedSavedPresetId] = useState<string>('')
  const [loadingSaved, setLoadingSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [presetError, setPresetError] = useState<string | null>(null)

  const helperText = useMemo(() => buildPromptHelperText(mode, values), [mode, values])

  const presetsForMode = useMemo(() => PROMPT_PRESETS.filter((p) => p.mode === mode), [mode])

  const refreshSavedPresets = async () => {
    setLoadingSaved(true)
    setPresetError(null)
    try {
      const res = await fetch('/api/admin/prompt-presets', { method: 'GET' })
      if (!res.ok) throw new Error('Failed to load presets')
      const json = await res.json()
      const all = (json.presets || []) as SavedPreset[]
      setSavedPresets(all.filter((p) => p.mode === mode))
    } catch (e) {
      setPresetError(e instanceof Error ? e.message : 'Failed to load presets')
    } finally {
      setLoadingSaved(false)
    }
  }

  useEffect(() => {
    // If the user flips mode, reset preset selection (keep current custom values)
    setSelectedPresetId('')
    onScenarioChange(null)
    setSelectedSavedPresetId('')
    // Refresh saved presets for the new mode
    void refreshSavedPresets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Prompt helper</h3>
          <p className="text-sm text-gray-600">
            Generate a strong instruction block for {mode === 'composite' ? 'composition' : 'style matching'}.
          </p>
        </div>
      </div>

      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">Save current prompt as preset</label>
            <input
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white"
              placeholder="Preset name (e.g. 'Moody gastro pub burger')"
              maxLength={120}
            />
          </div>
          <button
            onClick={async () => {
              if (!presetName.trim()) {
                setPresetError('Preset name is required')
                return
              }
              if (!currentPrompt.trim()) {
                setPresetError('Prompt is empty — add a prompt before saving')
                return
              }
              setSaving(true)
              setPresetError(null)
              try {
                const res = await fetch('/api/admin/prompt-presets', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: presetName.trim(),
                    mode,
                    scenarioId: null,
                    helperValues: values,
                    prompt: currentPrompt,
                  }),
                })
                if (!res.ok) {
                  const j = await res.json().catch(() => null)
                  throw new Error(j?.error || 'Failed to save preset')
                }
                setPresetName('')
                await refreshSavedPresets()
              } catch (e) {
                setPresetError(e instanceof Error ? e.message : 'Failed to save preset')
              } finally {
                setSaving(false)
              }
            }}
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-white"
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save preset'}
          </button>
          <button
            onClick={() => void refreshSavedPresets()}
            className="px-3 py-2 text-sm border border-gray-300 rounded hover:bg-white"
            disabled={loadingSaved}
          >
            Refresh
          </button>
        </div>
        {presetError && <p className="mt-2 text-sm text-red-700">{presetError}</p>}
        <p className="mt-2 text-xs text-gray-500">
          Note: presets store prompt text + helper settings only (no images stored).
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preset</label>
        <select
          value={selectedPresetId}
          onChange={(e) => {
            const id = e.target.value
            setSelectedPresetId(id)
            const preset = presetsForMode.find((p) => p.id === id)
            if (!preset) {
              onScenarioChange(null)
              return
            }
            setValues((v) => ({ ...v, ...preset.values }))
            onScenarioChange(preset.id)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Custom</option>
          {presetsForMode.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedPresetId && (
          <p className="mt-1 text-xs text-gray-500">
            {presetsForMode.find((p) => p.id === selectedPresetId)?.description}
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Saved presets (admin)</label>
        <select
          value={selectedSavedPresetId}
          onChange={async (e) => {
            const id = e.target.value
            setSelectedSavedPresetId(id)
            const preset = savedPresets.find((p) => p.id === id)
            if (!preset) return
            // Apply helper values and also load the saved prompt into the textarea (so "winning prompt" is one click away).
            setValues((v) => ({ ...v, ...(preset.helperValues || {}) }))
            onScenarioChange(preset.scenarioId || null)
            onReplacePrompt(preset.prompt)
          }}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
          disabled={loadingSaved}
        >
          <option value="">{loadingSaved ? 'Loading…' : 'Select a saved preset'}</option>
          {savedPresets.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        {selectedSavedPresetId && (
          <div className="mt-2 flex gap-2">
            <button
              onClick={async () => {
                const id = selectedSavedPresetId
                if (!id) return
                const ok = window.confirm('Delete this saved preset?')
                if (!ok) return
                const res = await fetch(`/api/admin/prompt-presets/${id}`, { method: 'DELETE' })
                if (res.ok) {
                  setSelectedSavedPresetId('')
                  await refreshSavedPresets()
                } else {
                  setPresetError('Failed to delete preset')
                }
              }}
              className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Dish name (optional)</label>
          <input
            value={values.dishName || ''}
            onChange={(e) => setValues((v) => ({ ...v, dishName: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g. Grilled salmon"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Cuisine (optional)</label>
          <input
            value={values.cuisine || ''}
            onChange={(e) => setValues((v) => ({ ...v, cuisine: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g. Modern British"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Plating style (optional)</label>
          <input
            value={values.platingStyle || ''}
            onChange={(e) => setValues((v) => ({ ...v, platingStyle: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g. minimal, white plate, fine dining"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Camera angle</label>
          <select
            value={values.cameraAngle || 'three_quarter'}
            onChange={(e) => setValues((v) => ({ ...v, cameraAngle: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="three_quarter">Three-quarter (45°)</option>
            <option value="top_down">Top-down (90°)</option>
            <option value="eye_level">Eye-level</option>
            <option value="macro">Macro close-up</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lighting</label>
          <select
            value={values.lighting || 'natural_soft'}
            onChange={(e) => setValues((v) => ({ ...v, lighting: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="natural_soft">Soft natural window light</option>
            <option value="studio_softbox">Soft studio softbox</option>
            <option value="moody_restaurant">Moody restaurant</option>
            <option value="bright_daylight">Bright daylight</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Background</label>
          <select
            value={values.background || 'restaurant_table'}
            onChange={(e) => setValues((v) => ({ ...v, background: e.target.value as any }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="restaurant_table">Restaurant table</option>
            <option value="neutral">Neutral</option>
            <option value="wood_table">Wood table</option>
            <option value="white_marble">White marble</option>
            <option value="dark_slate">Dark slate</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Must include (optional)</label>
          <input
            value={values.mustInclude || ''}
            onChange={(e) => setValues((v) => ({ ...v, mustInclude: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g. lemon wedge, parsley garnish"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Avoid (optional)</label>
          <input
            value={values.avoid || ''}
            onChange={(e) => setValues((v) => ({ ...v, avoid: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md"
            placeholder="e.g. messy sauce, clutter, extra props"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => onAppend(helperText)}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Append helper to prompt
        </button>
        <button
          onClick={() => onReplace(helperText)}
          className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50"
        >
          Replace prompt with helper
        </button>
      </div>

      <details className="rounded-md border border-gray-200 bg-gray-50 p-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Preview helper text</summary>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{helperText}</pre>
      </details>
    </div>
  )
}



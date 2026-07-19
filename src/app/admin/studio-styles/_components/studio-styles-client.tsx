'use client'

/**
 * Minimal admin CRUD for lighting + background reference libraries.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type {
  StudioBackgroundCategory,
  StudioBackgroundStyleRecord,
  StudioLightingStyleRecord,
} from '@/lib/studio/types'

type Tab = 'lighting' | 'background'

type LightingForm = {
  key: string
  name: string
  shortDescription: string
  promptFragment: string
  negativeConstraints: string
  thumbnailPath: string
  sortOrder: number
  isActive: boolean
}

type BackgroundForm = LightingForm & {
  category: StudioBackgroundCategory
  isPremium: boolean
}

const emptyLighting = (): LightingForm => ({
  key: '',
  name: '',
  shortDescription: '',
  promptFragment: '',
  negativeConstraints: '',
  thumbnailPath: '',
  sortOrder: 0,
  isActive: true,
})

const emptyBackground = (): BackgroundForm => ({
  ...emptyLighting(),
  category: 'surface',
  isPremium: false,
})

function lightingToForm(style: StudioLightingStyleRecord): LightingForm {
  return {
    key: style.key,
    name: style.name,
    shortDescription: style.short_description ?? '',
    promptFragment: style.prompt_fragment,
    negativeConstraints: style.negative_constraints ?? '',
    thumbnailPath: style.thumbnail_path ?? '',
    sortOrder: style.sort_order,
    isActive: style.is_active,
  }
}

function backgroundToForm(style: StudioBackgroundStyleRecord): BackgroundForm {
  return {
    ...lightingToForm(style),
    category: style.category,
    isPremium: style.is_premium,
  }
}

export function StudioStylesClient() {
  const [tab, setTab] = useState<Tab>('lighting')
  const [lighting, setLighting] = useState<StudioLightingStyleRecord[]>([])
  const [background, setBackground] = useState<StudioBackgroundStyleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [lightingForm, setLightingForm] = useState<LightingForm>(emptyLighting())
  const [backgroundForm, setBackgroundForm] = useState<BackgroundForm>(emptyBackground())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [lightingRes, backgroundRes] = await Promise.all([
        fetch('/api/admin/studio-styles/lighting'),
        fetch('/api/admin/studio-styles/background'),
      ])
      if (!lightingRes.ok || !backgroundRes.ok) {
        throw new Error('Failed to load styles')
      }
      const lightingJson = (await lightingRes.json()) as { styles: StudioLightingStyleRecord[] }
      const backgroundJson = (await backgroundRes.json()) as {
        styles: StudioBackgroundStyleRecord[]
      }
      setLighting(lightingJson.styles ?? [])
      setBackground(backgroundJson.styles ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const startCreate = () => {
    setEditingId(null)
    setCreating(true)
    if (tab === 'lighting') setLightingForm(emptyLighting())
    else setBackgroundForm(emptyBackground())
  }

  const startEditLighting = (style: StudioLightingStyleRecord) => {
    setCreating(false)
    setEditingId(style.id)
    setLightingForm(lightingToForm(style))
  }

  const startEditBackground = (style: StudioBackgroundStyleRecord) => {
    setCreating(false)
    setEditingId(style.id)
    setBackgroundForm(backgroundToForm(style))
  }

  const cancelForm = () => {
    setCreating(false)
    setEditingId(null)
  }

  const saveLighting = async () => {
    setBusyId(editingId ?? 'new')
    setError(null)
    try {
      const payload = {
        key: lightingForm.key,
        name: lightingForm.name,
        shortDescription: lightingForm.shortDescription || null,
        promptFragment: lightingForm.promptFragment,
        negativeConstraints: lightingForm.negativeConstraints || null,
        thumbnailPath: lightingForm.thumbnailPath || null,
        sortOrder: lightingForm.sortOrder,
        isActive: lightingForm.isActive,
      }
      const response = await fetch(
        editingId
          ? `/api/admin/studio-styles/lighting/${editingId}`
          : '/api/admin/studio-styles/lighting',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Save failed')
      }
      cancelForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusyId(null)
    }
  }

  const saveBackground = async () => {
    setBusyId(editingId ?? 'new')
    setError(null)
    try {
      const payload = {
        key: backgroundForm.key,
        name: backgroundForm.name,
        shortDescription: backgroundForm.shortDescription || null,
        category: backgroundForm.category,
        promptFragment: backgroundForm.promptFragment,
        negativeConstraints: backgroundForm.negativeConstraints || null,
        thumbnailPath: backgroundForm.thumbnailPath || null,
        sortOrder: backgroundForm.sortOrder,
        isActive: backgroundForm.isActive,
        isPremium: backgroundForm.isPremium,
      }
      const response = await fetch(
        editingId
          ? `/api/admin/studio-styles/background/${editingId}`
          : '/api/admin/studio-styles/background',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!response.ok) {
        const err = await response.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Save failed')
      }
      cancelForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setBusyId(null)
    }
  }

  const toggleActive = async (kind: Tab, id: string, isActive: boolean) => {
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/studio-styles/${kind}/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      })
      if (!response.ok) throw new Error('Toggle failed')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Toggle failed')
    } finally {
      setBusyId(null)
    }
  }

  const removeStyle = async (kind: Tab, id: string) => {
    if (!window.confirm('Delete this style permanently?')) return
    setBusyId(id)
    setError(null)
    try {
      const response = await fetch(`/api/admin/studio-styles/${kind}/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Delete failed')
      if (editingId === id) cancelForm()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setBusyId(null)
    }
  }

  const formOpen = creating || editingId !== null

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Studio Style Libraries</h1>
          <p className="mt-1 text-sm text-gray-600">
            Manage lighting and background/surface styles used by Photo Studio.
            Prompt fragments are server-only.
          </p>
        </div>
        <a href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
          ← Admin hub
        </a>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['lighting', 'background'] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setTab(value)
              cancelForm()
            }}
            className={[
              'px-4 py-2 text-sm font-medium capitalize',
              tab === value
                ? 'border-b-2 border-green-600 text-green-700'
                : 'text-gray-500 hover:text-gray-800',
            ].join(' ')}
          >
            {value}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={startCreate}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
        >
          Add {tab} style
        </button>
      </div>

      {formOpen && tab === 'lighting' && (
        <StyleFormShell
          title={editingId ? 'Edit lighting style' : 'New lighting style'}
          onCancel={cancelForm}
          onSave={() => void saveLighting()}
          busy={busyId !== null}
        >
          <LightingFields form={lightingForm} onChange={setLightingForm} />
        </StyleFormShell>
      )}

      {formOpen && tab === 'background' && (
        <StyleFormShell
          title={editingId ? 'Edit background style' : 'New background style'}
          onCancel={cancelForm}
          onSave={() => void saveBackground()}
          busy={busyId !== null}
        >
          <BackgroundFields form={backgroundForm} onChange={setBackgroundForm} />
        </StyleFormShell>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : tab === 'lighting' ? (
        <StyleTable
          rows={lighting.map((style) => ({
            id: style.id,
            key: style.key,
            name: style.name,
            meta: `sort ${style.sort_order} · ${style.thumbnail_path || 'no thumb'}`,
            isActive: style.is_active,
          }))}
          busyId={busyId}
          onEdit={(id) => {
            const style = lighting.find((row) => row.id === id)
            if (style) startEditLighting(style)
          }}
          onToggle={(id, isActive) => void toggleActive('lighting', id, isActive)}
          onDelete={(id) => void removeStyle('lighting', id)}
        />
      ) : (
        <StyleTable
          rows={background.map((style) => ({
            id: style.id,
            key: style.key,
            name: style.name,
            meta: `${style.category}${style.is_premium ? ' · premium' : ''} · sort ${style.sort_order}`,
            isActive: style.is_active,
          }))}
          busyId={busyId}
          onEdit={(id) => {
            const style = background.find((row) => row.id === id)
            if (style) startEditBackground(style)
          }}
          onToggle={(id, isActive) => void toggleActive('background', id, isActive)}
          onDelete={(id) => void removeStyle('background', id)}
        />
      )}
    </div>
  )
}

function StyleFormShell({
  title,
  children,
  onCancel,
  onSave,
  busy,
}: {
  title: string
  children: ReactNode
  onCancel: () => void
  onSave: () => void
  busy: boolean
}) {
  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border px-3 py-1.5 text-sm text-gray-700"
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSave}
          className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          disabled={busy}
        >
          Save
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  children,
  wide,
}: {
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <label className={['block text-xs font-medium text-gray-700', wide && 'sm:col-span-2'].filter(Boolean).join(' ')}>
      <span className="mb-1 block">{label}</span>
      {children}
    </label>
  )
}

const inputClass =
  'w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500'

function LightingFields({
  form,
  onChange,
}: {
  form: LightingForm
  onChange: (next: LightingForm) => void
}) {
  const set = <K extends keyof LightingForm>(key: K, value: LightingForm[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <>
      <Field label="Key (kebab-case)">
        <input className={inputClass} value={form.key} onChange={(e) => set('key', e.target.value)} />
      </Field>
      <Field label="Name">
        <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
      </Field>
      <Field label="Short description" wide>
        <input
          className={inputClass}
          value={form.shortDescription}
          onChange={(e) => set('shortDescription', e.target.value)}
        />
      </Field>
      <Field label="Prompt fragment" wide>
        <textarea
          className={inputClass}
          rows={3}
          value={form.promptFragment}
          onChange={(e) => set('promptFragment', e.target.value)}
        />
      </Field>
      <Field label="Negative constraints" wide>
        <textarea
          className={inputClass}
          rows={2}
          value={form.negativeConstraints}
          onChange={(e) => set('negativeConstraints', e.target.value)}
        />
      </Field>
      <Field label="Thumbnail basename">
        <input
          className={inputClass}
          value={form.thumbnailPath}
          onChange={(e) => set('thumbnailPath', e.target.value)}
          placeholder="light-natural"
        />
      </Field>
      <Field label="Sort order">
        <input
          type="number"
          className={inputClass}
          value={form.sortOrder}
          onChange={(e) => set('sortOrder', Number(e.target.value) || 0)}
        />
      </Field>
      <Field label="Active">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => set('isActive', e.target.checked)}
        />
      </Field>
    </>
  )
}

function BackgroundFields({
  form,
  onChange,
}: {
  form: BackgroundForm
  onChange: (next: BackgroundForm) => void
}) {
  const set = <K extends keyof BackgroundForm>(key: K, value: BackgroundForm[K]) =>
    onChange({ ...form, [key]: value })

  return (
    <>
      <LightingFields form={form} onChange={(next) => onChange({ ...form, ...next })} />
      <Field label="Category">
        <select
          className={inputClass}
          value={form.category}
          onChange={(e) => set('category', e.target.value as StudioBackgroundCategory)}
        >
          <option value="surface">surface</option>
          <option value="environment">environment</option>
          <option value="backdrop">backdrop</option>
        </select>
      </Field>
      <Field label="Premium">
        <input
          type="checkbox"
          checked={form.isPremium}
          onChange={(e) => set('isPremium', e.target.checked)}
        />
      </Field>
    </>
  )
}

function StyleTable({
  rows,
  busyId,
  onEdit,
  onToggle,
  onDelete,
}: {
  rows: Array<{ id: string; key: string; name: string; meta: string; isActive: boolean }>
  busyId: string | null
  onEdit: (id: string) => void
  onToggle: (id: string, isActive: boolean) => void
  onDelete: (id: string) => void
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">No styles yet.</p>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Key</th>
            <th className="px-3 py-2">Meta</th>
            <th className="px-3 py-2">Active</th>
            <th className="px-3 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-medium text-gray-900">{row.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-gray-600">{row.key}</td>
              <td className="px-3 py-2 text-xs text-gray-500">{row.meta}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  disabled={busyId === row.id}
                  onClick={() => onToggle(row.id, row.isActive)}
                  className={[
                    'rounded px-2 py-0.5 text-xs font-medium',
                    row.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-600',
                  ].join(' ')}
                >
                  {row.isActive ? 'Active' : 'Off'}
                </button>
              </td>
              <td className="space-x-2 px-3 py-2">
                <button
                  type="button"
                  className="text-xs font-medium text-green-700 hover:underline"
                  onClick={() => onEdit(row.id)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-red-600 hover:underline"
                  disabled={busyId === row.id}
                  onClick={() => onDelete(row.id)}
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

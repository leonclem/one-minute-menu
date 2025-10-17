'use client'

import React from 'react'
import { Button, Input } from '@/components/ui'
import type { ModifierGroupType, ModifierOptionType } from '@/lib/extraction/schema-stage2'

interface ModifierGroupEditorProps {
  groups: ModifierGroupType[]
  onChange: (next: ModifierGroupType[]) => void
  currency?: string
  readonly?: boolean
}

export default function ModifierGroupEditor({ groups, onChange, currency = '', readonly = false }: ModifierGroupEditorProps) {
  const [local, setLocal] = React.useState<ModifierGroupType[]>(groups || [])

  React.useEffect(() => {
    setLocal(groups || [])
  }, [groups])

  const addGroup = () => {
    if (readonly) return
    const next: ModifierGroupType[] = [
      ...local,
      { name: '', type: 'single', required: false, options: [{ name: '', priceDelta: 0 }] }
    ]
    setLocal(next)
    onChange(next)
  }

  const updateGroup = (index: number, updates: Partial<ModifierGroupType>) => {
    if (readonly) return
    const next = local.map((g, i) => (i === index ? { ...g, ...updates } : g))
    setLocal(next)
    onChange(next)
  }

  const removeGroup = (index: number) => {
    if (readonly) return
    const next = local.filter((_, i) => i !== index)
    setLocal(next)
    onChange(next)
  }

  const addOption = (groupIdx: number) => {
    if (readonly) return
    const next = local.map((g, i) =>
      i === groupIdx ? { ...g, options: [...g.options, { name: '', priceDelta: 0 }] } : g
    )
    setLocal(next)
    onChange(next)
  }

  const updateOption = (groupIdx: number, optionIdx: number, updates: Partial<ModifierOptionType>) => {
    if (readonly) return
    const next = local.map((g, i) => {
      if (i !== groupIdx) return g
      const options = g.options.map((o, oi) => (oi === optionIdx ? { ...o, ...updates } : o))
      return { ...g, options }
    })
    setLocal(next)
    onChange(next)
  }

  const removeOption = (groupIdx: number, optionIdx: number) => {
    if (readonly) return
    const next = local.map((g, i) => {
      if (i !== groupIdx) return g
      const options = g.options.filter((_, oi) => oi !== optionIdx)
      return { ...g, options }
    })
    setLocal(next)
    onChange(next)
  }

  const formatDelta = (delta?: number) => {
    if (delta === undefined) return ''
    if (!currency) return String(delta)
    const sign = delta >= 0 ? '+' : '-'
    return `${sign}${currency} ${Math.abs(delta).toFixed(2)}`
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-secondary-800">Modifier Groups</h4>
          <p className="text-xs text-secondary-600">Configure add-ons and choices; set required and selection type.</p>
        </div>
        {!readonly && (
          <Button variant="primary" size="sm" onClick={addGroup}>Add group</Button>
        )}
      </div>

      {local.length === 0 ? (
        <div className="p-4 border border-dashed rounded text-sm text-secondary-600">No modifier groups. Add one to begin.</div>
      ) : (
        <div className="space-y-4">
          {local.map((group, gi) => (
            <div key={gi} className="border rounded">
              <div className="p-3 bg-secondary-50 border-b flex items-center gap-3">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                  <div>
                    {readonly ? (
                      <div className="text-sm text-secondary-900">{group.name || '-'}</div>
                    ) : (
                      <Input
                        value={group.name}
                        placeholder="Group name (e.g., Choose a Sauce)"
                        onChange={(e) => updateGroup(gi, { name: e.target.value })}
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-secondary-600">Type</span>
                    {readonly ? (
                      <span className="text-sm text-secondary-900">{group.type}</span>
                    ) : (
                      <select
                        className="px-2 py-1 border rounded text-sm"
                        value={group.type}
                        onChange={(e) => updateGroup(gi, { type: e.target.value as ModifierGroupType['type'] })}
                      >
                        <option value="single">single</option>
                        <option value="multi">multi</option>
                      </select>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-xs text-secondary-600">
                      <input
                        type="checkbox"
                        checked={group.required}
                        disabled={readonly}
                        onChange={(e) => updateGroup(gi, { required: e.target.checked })}
                      />
                      required
                    </label>
                  </div>
                </div>

                {!readonly && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => removeGroup(gi)}>Remove group</Button>
                  </div>
                )}
              </div>

              <div className="p-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full border rounded">
                    <thead>
                      <tr className="bg-secondary-50 text-secondary-700 text-left text-xs">
                        <th className="px-3 py-2 border">Option</th>
                        <th className="px-3 py-2 border">Price Delta</th>
                        {!readonly && <th className="px-3 py-2 border w-24">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {group.options.map((opt, oi) => (
                        <tr key={oi} className="text-sm">
                          <td className="px-3 py-2 border align-top">
                            {readonly ? (
                              <span className="text-secondary-900">{opt.name || '-'}</span>
                            ) : (
                              <Input
                                value={opt.name}
                                placeholder="e.g., Spicy Mayo"
                                onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                              />
                            )}
                          </td>
                          <td className="px-3 py-2 border align-top">
                            {readonly ? (
                              <span className="font-medium text-secondary-900">{formatDelta(opt.priceDelta)}</span>
                            ) : (
                              <Input
                                type="number"
                                step="0.01"
                                value={
                                  opt.priceDelta === undefined || Number.isNaN(opt.priceDelta)
                                    ? ''
                                    : String(opt.priceDelta)
                                }
                                onChange={(e) => updateOption(gi, oi, { priceDelta: e.target.value === '' ? undefined : Number(e.target.value) })}
                              />
                            )}
                          </td>
                          {!readonly && (
                            <td className="px-3 py-2 border">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => removeOption(gi, oi)}>Remove</Button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!readonly && (
                  <div className="mt-2">
                    <Button variant="outline" size="sm" onClick={() => addOption(gi)}>Add option</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}



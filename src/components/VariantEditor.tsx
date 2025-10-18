'use client'

import React, { useMemo, useState } from 'react'
import { Button, Input } from '@/components/ui'
import type { ItemVariantType } from '@/lib/extraction/schema-stage2'

interface VariantEditorProps {
  variants: ItemVariantType[]
  onChange: (next: ItemVariantType[]) => void
  currency?: string
  readonly?: boolean
}

export default function VariantEditor({ variants, onChange, currency = '', readonly = false }: VariantEditorProps) {
  const [local, setLocal] = useState<ItemVariantType[]>(variants || [])

  React.useEffect(() => {
    setLocal(variants || [])
  }, [variants])

  const addVariant = () => {
    if (readonly) return
    const next = [...local, { size: '', price: 0 }]
    setLocal(next)
    onChange(next)
  }

  const updateVariant = (index: number, updates: Partial<ItemVariantType>) => {
    if (readonly) return
    const next = local.map((v, i) => (i === index ? { ...v, ...updates } : v))
    setLocal(next)
    onChange(next)
  }

  const removeVariant = (index: number) => {
    if (readonly) return
    const next = local.filter((_, i) => i !== index)
    setLocal(next)
    onChange(next)
  }

  const formatCurrency = (value: number) => {
    if (!currency) return value.toString()
    return `${currency} ${Number.isFinite(value) ? value.toFixed(2) : ''}`
  }

  const totalVariants = useMemo(() => local.length, [local])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-secondary-800">Variants</h4>
          <p className="text-xs text-secondary-600">Add sizes and prices; use attributes for extra info.</p>
        </div>
        {!readonly && (
          <Button variant="primary" size="sm" onClick={addVariant}>Add variant</Button>
        )}
      </div>

      {totalVariants === 0 ? (
        <div className="p-4 border border-dashed rounded text-sm text-secondary-600">No variants. Add one to begin.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border rounded">
            <thead>
              <tr className="bg-secondary-50 text-secondary-700 text-left text-xs">
                <th className="px-3 py-2 border">Size</th>
                <th className="px-3 py-2 border">Price</th>
                <th className="px-3 py-2 border">Attributes</th>
                {!readonly && <th className="px-3 py-2 border w-24">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {local.map((v, i) => (
                <tr key={i} className="text-sm">
                  <td className="px-3 py-2 border align-top">
                    {readonly ? (
                      <span className="text-secondary-900">{v.size || '-'}</span>
                    ) : (
                      <Input
                        value={v.size ?? ''}
                        placeholder="e.g., Large, 500g"
                        onChange={(e) => updateVariant(i, { size: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 border align-top">
                    {readonly ? (
                      <span className="font-medium text-secondary-900">{formatCurrency(v.price)}</span>
                    ) : (
                      <Input
                        type="number"
                        step="0.01"
                        value={Number.isFinite(v.price) ? String(v.price) : ''}
                        onChange={(e) => updateVariant(i, { price: Number(e.target.value || 0) })}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 border">
                    <AttributesEditor
                      value={v.attributes || {}}
                      onChange={(attrs) => updateVariant(i, { attributes: attrs })}
                      readonly={readonly}
                    />
                  </td>
                  {!readonly && (
                    <td className="px-3 py-2 border">
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => removeVariant(i)}>Remove</Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!readonly && totalVariants > 0 && (
        <BulkAdjust onApply={(percent) => {
          const multiplier = 1 + percent / 100
          const next = local.map(v => ({ ...v, price: Number((v.price * multiplier).toFixed(2)) }))
          setLocal(next)
          onChange(next)
        }} />
      )}
    </div>
  )
}

interface AttributesEditorProps {
  value: Record<string, string | number | boolean>
  onChange: (next: Record<string, string | number | boolean>) => void
  readonly?: boolean
}

function AttributesEditor({ value, onChange, readonly = false }: AttributesEditorProps) {
  const [entries, setEntries] = useState<[string, string | number | boolean][]>(Object.entries(value || {}))

  React.useEffect(() => {
    setEntries(Object.entries(value || {}))
  }, [value])

  const setPair = (idx: number, key: string, val: string) => {
    const next = entries.map((kv, i) => (i === idx ? [key, coerce(val)] : kv)) as [string, string | number | boolean][]
    setEntries(next)
    onChange(Object.fromEntries(next))
  }

  const addPair = () => {
    const next = [...entries, ['', ''] as [string, string | number | boolean]]
    setEntries(next)
    onChange(Object.fromEntries(next))
  }

  const removePair = (idx: number) => {
    const next = entries.filter((_, i) => i !== idx)
    setEntries(next)
    onChange(Object.fromEntries(next))
  }

  return (
    <div className="space-y-2">
      {entries.length === 0 && (
        <div className="text-xs text-secondary-500">No attributes</div>
      )}
      {entries.map(([k, v], idx) => (
        <div key={idx} className="flex items-center gap-2">
          {readonly ? (
            <>
              <span className="text-xs text-secondary-700">{k || '-'}</span>
              <span className="text-xs text-secondary-900">{String(v)}</span>
            </>
          ) : (
            <>
              <Input
                value={k}
                placeholder="key (e.g., forPax)"
                onChange={(e) => setPair(idx, e.target.value, String(v))}
              />
              <Input
                value={String(v)}
                placeholder="value"
                onChange={(e) => setPair(idx, k, e.target.value)}
              />
              <Button variant="outline" size="sm" onClick={() => removePair(idx)}>Remove</Button>
            </>
          )}
        </div>
      ))}
      {!readonly && (
        <Button variant="outline" size="sm" onClick={addPair}>Add attribute</Button>
      )}
    </div>
  )
}

function coerce(input: string): string | number | boolean {
  const trimmed = input.trim()
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const num = Number(trimmed)
  if (!Number.isNaN(num) && trimmed !== '') return num
  return input
}

function BulkAdjust({ onApply }: { onApply: (percent: number) => void }) {
  const [percent, setPercent] = useState<string>('10')
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-secondary-700">Bulk adjust prices</span>
      <Input
        type="number"
        step="0.1"
        value={percent}
        onChange={(e) => setPercent(e.target.value)}
        className="w-24"
      />
      <span className="text-xs text-secondary-500">%</span>
      <Button variant="outline" size="sm" onClick={() => onApply(Number(percent || 0))}>Apply</Button>
    </div>
  )
}



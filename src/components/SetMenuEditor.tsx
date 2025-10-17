'use client'

import React from 'react'
import { Button, Input } from '@/components/ui'
import type { SetMenuType, SetMenuCourseType, SetMenuOptionType } from '@/lib/extraction/schema-stage2'

interface SetMenuEditorProps {
  value: SetMenuType | undefined
  onChange: (next: SetMenuType | undefined) => void
  currency?: string
  readonly?: boolean
}

export default function SetMenuEditor({ value, onChange, currency = '', readonly = false }: SetMenuEditorProps) {
  const [local, setLocal] = React.useState<SetMenuType | undefined>(value)

  React.useEffect(() => {
    setLocal(value)
  }, [value])

  const ensureSet = () => {
    if (readonly) return
    const next: SetMenuType = local || { courses: [] }
    setLocal(next)
    onChange(next)
    return next
  }

  const addCourse = () => {
    if (readonly) return
    const base = ensureSet()
    if (!base) return
    const next = { ...base, courses: [...(base.courses || []), { name: '', options: [{ name: '' }] }] }
    setLocal(next)
    onChange(next)
  }

  const updateCourse = (index: number, updates: Partial<SetMenuCourseType>) => {
    if (readonly || !local) return
    const nextCourses = local.courses.map((c, i) => (i === index ? { ...c, ...updates } : c))
    const next = { ...local, courses: nextCourses }
    setLocal(next)
    onChange(next)
  }

  const removeCourse = (index: number) => {
    if (readonly || !local) return
    const nextCourses = local.courses.filter((_, i) => i !== index)
    const next = { ...local, courses: nextCourses }
    setLocal(next)
    onChange(next)
  }

  const addOption = (courseIdx: number) => {
    if (readonly || !local) return
    const nextCourses = local.courses.map((c, i) => (i === courseIdx ? { ...c, options: [...c.options, { name: '' }] } : c))
    const next = { ...local, courses: nextCourses }
    setLocal(next)
    onChange(next)
  }

  const updateOption = (courseIdx: number, optionIdx: number, updates: Partial<SetMenuOptionType>) => {
    if (readonly || !local) return
    const nextCourses = local.courses.map((c, i) => {
      if (i !== courseIdx) return c
      const options = c.options.map((o, oi) => (oi === optionIdx ? { ...o, ...updates } : o))
      return { ...c, options }
    })
    const next = { ...local, courses: nextCourses }
    setLocal(next)
    onChange(next)
  }

  const removeOption = (courseIdx: number, optionIdx: number) => {
    if (readonly || !local) return
    const nextCourses = local.courses.map((c, i) => {
      if (i !== courseIdx) return c
      const options = c.options.filter((_, oi) => oi !== optionIdx)
      return { ...c, options }
    })
    const next = { ...local, courses: nextCourses }
    setLocal(next)
    onChange(next)
  }

  const setNotes = (notes: string) => {
    if (readonly) return
    const base = ensureSet()
    if (!base) return
    const next = { ...base, notes: notes || undefined }
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
          <h4 className="text-sm font-medium text-secondary-800">Set Menu</h4>
          <p className="text-xs text-secondary-600">Define courses and options. Use price deltas for surcharges.</p>
        </div>
        {!readonly && (
          <Button variant="primary" size="sm" onClick={addCourse}>Add course</Button>
        )}
      </div>

      {!local || local.courses.length === 0 ? (
        <div className="p-4 border border-dashed rounded text-sm text-secondary-600">No courses. Add one to begin.</div>
      ) : (
        <div className="space-y-4">
          {local.courses.map((course, ci) => (
            <div key={ci} className="border rounded">
              <div className="p-3 bg-secondary-50 border-b flex items-center gap-3">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2 items-center">
                  <div>
                    {readonly ? (
                      <div className="text-sm text-secondary-900">{course.name || '-'}</div>
                    ) : (
                      <Input
                        value={course.name}
                        placeholder="Course name (e.g., Starter)"
                        onChange={(e) => updateCourse(ci, { name: e.target.value })}
                      />
                    )}
                  </div>
                </div>
                {!readonly && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => removeCourse(ci)}>Remove course</Button>
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
                      {course.options.map((opt, oi) => (
                        <tr key={oi} className="text-sm">
                          <td className="px-3 py-2 border align-top">
                            {readonly ? (
                              <span className="text-secondary-900">{opt.name || '-'}</span>
                            ) : (
                              <Input
                                value={opt.name}
                                placeholder="e.g., Premium ice cream"
                                onChange={(e) => updateOption(ci, oi, { name: e.target.value })}
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
                                onChange={(e) => updateOption(ci, oi, { priceDelta: e.target.value === '' ? undefined : Number(e.target.value) })}
                              />
                            )}
                          </td>
                          {!readonly && (
                            <td className="px-3 py-2 border">
                              <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => removeOption(ci, oi)}>Remove</Button>
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
                    <Button variant="outline" size="sm" onClick={() => addOption(ci)}>Add option</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div className="space-y-2">
        <div className="text-xs text-secondary-600">Notes</div>
        {readonly ? (
          <div className="text-sm text-secondary-900">{local?.notes || '-'}</div>
        ) : (
          <Input
            value={local?.notes || ''}
            placeholder="e.g., Includes coffee or tea"
            onChange={(e) => setNotes(e.target.value)}
          />
        )}
      </div>
    </div>
  )
}



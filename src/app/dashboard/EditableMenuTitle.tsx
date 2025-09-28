'use client'

import { useEffect, useState } from 'react'

export default function EditableMenuTitle({ id, name }: { id: string; name: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [displayName, setDisplayName] = useState(name)
  const [loading, setLoading] = useState(false)

  // Sync incoming name changes (e.g., after server refresh) to local states
  useEffect(() => {
    setDisplayName(name)
    if (!editing) setValue(name)
  }, [name])

  const commit = async () => {
    const newName = value.trim()
    if (!newName || newName === name) {
      setEditing(false)
      setValue(name)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/menus/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName })
      })
      if (!res.ok) throw new Error('Failed')
      // Optimistically update local display name
      setDisplayName(newName)
      setEditing(false)
    } catch {
      setValue(name)
      setEditing(false)
    } finally {
      setLoading(false)
    }
  }

  if (editing) {
    return (
      <input
        className="w-full border border-secondary-300 rounded px-2 py-1 text-base font-semibold"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        disabled={loading}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') { setEditing(false); setValue(name) }
        }}
      />
    )
  }

  return (
    <div className="group inline-flex items-center gap-2">
      <span
        className="font-semibold text-secondary-900"
        onClick={() => setEditing(true)}
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setEditing(true) }}
        title="Rename menu"
      >
        {displayName}
      </span>
      <button
        type="button"
        className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity text-secondary-400 hover:text-secondary-600 p-0 h-4 min-h-0"
        onClick={() => setEditing(true)}
        aria-label="Rename menu"
      >
        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M13.586 3a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM12.172 4.414L4 12.586V16h3.414l8.172-8.172-3.414-3.414z" />
        </svg>
      </button>
    </div>
  )
}



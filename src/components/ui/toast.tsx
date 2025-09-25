"use client"

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

export interface ToastOptions {
  title?: string
  description?: string
  type?: ToastType
  durationMs?: number
}

interface ToastItem extends Required<ToastOptions> {
  id: string
}

interface ToastContextValue {
  showToast: (opts: ToastOptions) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const showToast = useCallback((opts: ToastOptions) => {
    const id = Math.random().toString(36).slice(2)
    const toast: ToastItem = {
      id,
      title: opts.title ?? '',
      description: opts.description ?? '',
      type: opts.type ?? 'info',
      durationMs: opts.durationMs ?? 3500,
    }
    setToasts(prev => [...prev, toast])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), toast.durationMs)
  }, [])

  const value = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast viewport */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            className={
              `min-w-[240px] max-w-[360px] rounded-lg shadow-lg p-3 text-sm ` +
              (t.type === 'success'
                ? 'bg-green-50 border border-green-300 text-green-900'
                : t.type === 'error'
                ? 'bg-red-50 border border-red-300 text-red-900'
                : 'bg-gray-50 border border-gray-300 text-gray-900')
            }
          >
            {t.title && <div className="font-medium mb-0.5">{t.title}</div>}
            {t.description && <div className="opacity-90">{t.description}</div>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}



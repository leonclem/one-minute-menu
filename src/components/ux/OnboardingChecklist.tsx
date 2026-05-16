'use client'

import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import type { Menu } from '@/types'

interface ChecklistItem {
  id: string
  label: string
  completed: boolean
  action?: () => void
}

interface OnboardingChecklistProps {
  menu: Menu | null
  menuId: string
  onAddTopDish: () => void
  onUploadLogo: () => void
  onAddItems: () => void
  onAddContactDetails: () => void
}

/** Returns true when all onboarding tasks are complete for the given menu. */
export function isOnboardingComplete(menu: Menu | null): boolean {
  if (!menu) return false
  const realItemCount = (menu.items ?? []).filter(i => !i.isPlaceholder).length
  const hasLogo = !!menu.logoUrl
  const hasVenueDetails = !!(
    menu.venueInfo?.address ||
    menu.venueInfo?.phone ||
    menu.venueInfo?.email
  )
  return realItemCount >= 1 && hasLogo && realItemCount >= 3 && hasVenueDetails
}

export function OnboardingChecklist({
  menu,
  menuId,
  onAddTopDish,
  onUploadLogo,
  onAddItems,
  onAddContactDetails,
}: OnboardingChecklistProps) {
  if (!menu) return null

  const realItemCount = (menu.items ?? []).filter(i => !i.isPlaceholder).length
  const hasLogo = !!menu.logoUrl
  const hasVenueDetails = !!(
    menu.venueInfo?.address ||
    menu.venueInfo?.phone ||
    menu.venueInfo?.email
  )

  const items: ChecklistItem[] = [
    {
      id: 'add-dish',
      label: 'Add your top-selling dish',
      completed: realItemCount >= 1,
      action: onAddTopDish,
    },
    {
      id: 'upload-logo',
      label: 'Upload your logo',
      completed: hasLogo,
      action: onUploadLogo,
    },
    {
      id: 'add-items',
      label: 'Add 2+ more items',
      completed: realItemCount >= 3,
      action: onAddItems,
    },
    {
      id: 'contact-details',
      label: 'Add contact details',
      completed: hasVenueDetails,
      action: onAddContactDetails,
    },
  ]

  const completedCount = items.filter(i => i.completed).length

  // Show completion panel (with dismiss) when all tasks are done
  if (completedCount === items.length) {
    return <OnboardingComplete menuId={menuId} />
  }

  return (
    <div className="mb-3 rounded-xl overflow-hidden border border-ux-primary/30 shadow-sm">
      {/* Panel header — solid teal */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-ux-primary">
        <div className="flex items-center gap-2">
          {/* Rocket icon */}
          <svg className="w-4 h-4 text-white flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.82m5.84-2.56a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.63 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.82m2.56-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          </svg>
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            Get started
          </span>
        </div>
        <span className="text-xs font-semibold text-white/80 tabular-nums bg-white/20 px-1.5 py-0.5 rounded-full">
          {completedCount}/{items.length}
        </span>
      </div>

      {/* Progress bar — white track on teal, filled white */}
      <div className="h-1 bg-ux-primary">
        <div
          className="h-full bg-white/40 transition-all duration-500"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Action list */}
      <ul className="px-2 py-1.5 space-y-1">
        {items.map(item => (
          <li key={item.id}>
            {item.completed ? (
              /* Completed row — muted, no interaction */
              <div className="flex items-center gap-2.5 px-2.5 py-1.5 opacity-45">
                <svg className="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm line-through text-gray-400">{item.label}</span>
              </div>
            ) : (
              /* Incomplete row — styled as a CTA button */
              <button
                type="button"
                className="w-full flex items-center gap-2.5 text-left rounded-lg px-2.5 py-2 bg-white border border-gray-200 shadow-sm hover:border-ux-primary/50 hover:shadow-md hover:bg-ux-primary/5 active:scale-[0.98] transition-all duration-150 cursor-pointer group"
                onClick={item.action}
              >
                <svg
                  className="w-4 h-4 text-ux-primary flex-shrink-0 group-hover:translate-x-0.5 transition-transform duration-150"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="text-sm font-medium text-ux-text flex-1">{item.label}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function OnboardingComplete({ menuId }: { menuId: string }) {
  const storageKey = `onboarding-complete-dismissed`
  const [visible, setVisible] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(storageKey) !== 'true'
  })

  const dismiss = () => {
    localStorage.setItem(storageKey, 'true')
    setVisible(false)
  }

  if (!visible) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      style={{ animation: 'gm-fade-in 0.2s ease-out' }}
      onClick={(e) => { if (e.target === e.currentTarget) dismiss() }}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'gm-scale-in 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-complete-title"
      >
        {/* Coloured top strip */}
        <div className="h-1.5 bg-gradient-to-r from-emerald-400 to-teal-400" />

        <div className="px-6 py-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <span className="text-3xl leading-none" aria-hidden>🎉</span>
            <div>
              <h2 id="onboarding-complete-title" className="text-base font-bold text-gray-900">
                You&apos;re all set!
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">Your menu is looking great.</p>
            </div>
          </div>

          {/* Body */}
          <p className="text-sm text-gray-600 leading-relaxed">
            Nice work completing the basics. Here are two great ways to take things further:
          </p>

          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-base leading-none" aria-hidden>🎨</span>
              <span className="text-sm text-gray-700">
                Use the <strong>style controls</strong> in the panel to tweak your layout, colour palette, and fonts until the menu feels like you.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 text-base leading-none" aria-hidden>✏️</span>
              <span className="text-sm text-gray-700">
                Visit{' '}
                <Link
                  href={`/menus/${menuId}/extracted`}
                  className="font-semibold text-teal-600 underline underline-offset-2 hover:text-teal-800 transition-colors"
                  onClick={dismiss}
                >
                  Menu Items
                </Link>
                {' '}to add descriptions, photos, and dietary tags to your dishes.
              </span>
            </li>
          </ul>

          {/* CTA */}
          <button
            type="button"
            onClick={dismiss}
            className="w-full mt-1 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-white text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
          >
            Got it, let&apos;s go
          </button>
        </div>
      </div>

      <style>{`
        @keyframes gm-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes gm-scale-in {
          from { opacity: 0; transform: scale(0.88) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);    }
        }
      `}</style>
    </div>,
    document.body
  )
}

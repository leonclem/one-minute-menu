'use client'

import { useEffect, useState } from 'react'

import { StudioFeedbackPanel } from './studio-feedback-panel'

const FEEDBACK_TRIGGER_DELAY_MS = 10_000
const FEEDBACK_TRIGGER_PULSE_MS = 1_500
const REVEALED_TRIGGER_STORAGE_KEY_PREFIX = 'studio-feedback-trigger-revealed:'

type PromptState = 'checking' | 'ready' | 'completed'

export interface StudioFeedbackPromptProps {
  studioImageId: string
}

function revealedTriggerStorageKey(studioImageId: string): string {
  return `${REVEALED_TRIGGER_STORAGE_KEY_PREFIX}${studioImageId}`
}

function hasRevealedTrigger(studioImageId: string): boolean {
  try {
    return window.sessionStorage.getItem(revealedTriggerStorageKey(studioImageId)) === 'true'
  } catch {
    return false
  }
}

function rememberRevealedTrigger(studioImageId: string): void {
  try {
    window.sessionStorage.setItem(revealedTriggerStorageKey(studioImageId), 'true')
  } catch {
    // The current component state still keeps the trigger visible when storage is unavailable.
  }
}

function forgetRevealedTrigger(studioImageId: string): void {
  try {
    window.sessionStorage.removeItem(revealedTriggerStorageKey(studioImageId))
  } catch {
    // Completion remains persisted server-side even when session storage is unavailable.
  }
}

/**
 * A deliberately non-blocking entry point for generated-image feedback.
 * The trigger appears after the customer has had time to inspect the image and
 * opens the feedback modal only when they choose to engage.
 */
export function StudioFeedbackPrompt({ studioImageId }: StudioFeedbackPromptProps) {
  const [promptState, setPromptState] = useState<PromptState>('checking')
  const [isVisible, setIsVisible] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPulsing, setIsPulsing] = useState(false)

  useEffect(() => {
    let cancelled = false
    let revealTimer: number | undefined
    let pulseTimer: number | undefined

    const showTrigger = (withPulse: boolean) => {
      if (cancelled) return
      setIsVisible(true)
      setIsPulsing(withPulse)
      if (!withPulse) return

      pulseTimer = window.setTimeout(() => {
        if (!cancelled) setIsPulsing(false)
      }, FEEDBACK_TRIGGER_PULSE_MS)
    }

    const revealTrigger = () => {
      if (hasRevealedTrigger(studioImageId)) {
        showTrigger(false)
        return
      }

      revealTimer = window.setTimeout(() => {
        if (cancelled) return
        rememberRevealedTrigger(studioImageId)
        showTrigger(true)
      }, FEEDBACK_TRIGGER_DELAY_MS)
    }

    setPromptState('checking')
    setIsVisible(false)
    setIsModalOpen(false)
    setIsPulsing(false)

    void fetch(`/api/studio/feedback?studioImageId=${encodeURIComponent(studioImageId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load feedback prompt state')
        return response.json() as Promise<{ completed?: boolean }>
      })
      .then((payload) => {
        if (cancelled) return
        if (payload.completed === true) {
          setPromptState('completed')
          forgetRevealedTrigger(studioImageId)
          return
        }
        setPromptState('ready')
        revealTrigger()
      })
      .catch(() => {
        // Keep feedback available if the status lookup is temporarily unavailable.
        if (cancelled) return
        setPromptState('ready')
        revealTrigger()
      })

    return () => {
      cancelled = true
      if (revealTimer !== undefined) window.clearTimeout(revealTimer)
      if (pulseTimer !== undefined) window.clearTimeout(pulseTimer)
    }
  }, [studioImageId])

  const openModal = () => {
    setIsPulsing(false)
    setIsModalOpen(true)
  }

  const complete = () => {
    forgetRevealedTrigger(studioImageId)
    setPromptState('completed')
    setIsModalOpen(false)
    setIsVisible(false)
  }

  if (promptState !== 'ready' || !isVisible) return null

  return (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={openModal}
          title="Share feedback about this generated result"
          className={`inline-flex items-center gap-1.5 rounded-full border border-ux-primary/30 bg-white px-3 py-1.5 text-xs font-semibold text-ux-primary shadow-sm transition hover:border-ux-primary hover:bg-ux-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ux-primary/40 ${
            isPulsing ? 'animate-pulse motion-reduce:animate-none' : ''
          }`}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="M8 10h.01M12 10h.01M16 10h.01" />
            <path d="M21 12a8 8 0 0 1-8 8 8.7 8.7 0 0 1-3.5-.73L3 21l1.73-5.5A8 8 0 1 1 21 12Z" />
          </svg>
          Rate result
        </button>
      </div>
      {isModalOpen && <StudioFeedbackPanel studioImageId={studioImageId} onComplete={complete} />}
    </>
  )
}

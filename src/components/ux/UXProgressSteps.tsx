'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'

type StepId = 'upload' | 'extract' | 'extracted' | 'template' | 'export'

interface UXProgressStepsProps {
  currentStep: StepId | undefined
  menuId: string
  clickable?: boolean
}

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'upload', label: 'Upload' },
  { id: 'extract', label: 'Extract' },
  { id: 'extracted', label: 'Items' },
  { id: 'template', label: 'Template' },
  { id: 'export', label: 'Export' },
]

export function UXProgressSteps({ currentStep, menuId, clickable = true }: UXProgressStepsProps) {
  const router = useRouter()

  const activeIndex = useMemo(() => {
    const idx = STEPS.findIndex(s => s.id === currentStep)
    return idx >= 0 ? idx : 0
  }, [currentStep])

  const handleNavigate = (id: StepId, index: number) => {
    if (!clickable) return
    if (index > activeIndex) return
    router.push(`/ux/menus/${menuId}/${id}`)
  }

  return (
    <div className="container-ux mt-6 md:mt-8 mb-2 md:mb-4">
      <div className="flex justify-center">
        <div
          className="inline-flex items-center gap-3 md:gap-4 bg-white/70 backdrop-blur-sm px-3 md:px-4 py-2 md:py-2.5 rounded border border-ux-border"
          role="group"
          aria-label="Progress through menu creation steps"
        >
          {STEPS.map((step, index) => {
            const isCompleted = index < activeIndex
            const isCurrent = index === activeIndex
            const base =
              'grid place-items-center font-semibold transition transform select-none'
            const size = 'w-8 h-8 md:w-10 md:h-10'
            const styles = isCompleted
              ? 'bg-ux-primary text-white'
              : isCurrent
                ? 'bg-ux-primary/85 text-white ring-2 ring-white/70'
                : 'bg-secondary-100/70 text-secondary-700 border border-secondary-500'
            const label = index + 1
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleNavigate(step.id, index)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`${step.label}${isCurrent ? ' (current step)' : isCompleted ? ' (completed)' : ''}`}
                className={`${base} ${size} ${styles} ${clickable && index <= activeIndex ? 'cursor-pointer hover:scale-[1.03]' : 'cursor-default'}`}
                disabled={!clickable || index > activeIndex}
              >
                {index === STEPS.length - 1 && (isCurrent || isCompleted) ? (
                  <span aria-hidden>🏆</span>
                ) : isCompleted ? (
                  <svg aria-hidden className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <span className="text-sm md:text-base">{label}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}


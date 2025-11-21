"use client"

import { usePathname, useRouter } from 'next/navigation'
import { UXSection, UXButton, UXErrorFeedback } from '@/components/ux'

export default function UXMenuFlowError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const pathname = usePathname()
  const router = useRouter()

  const isDemo = pathname?.includes('/demo-') ?? false

  const title = isDemo
    ? 'We hit a snag with your demo menu'
    : 'We hit a snag processing your menu'

  const description = isDemo
    ? 'Your demo session ran into an issue while loading or exporting the sample menu. You can retry or start a fresh demo.'
    : 'An unexpected error occurred while processing your menu. You can retry this step or go back and restart the flow.'

  const handleStartOver = () => {
    router.push('/ux')
  }

  return (
    <UXSection>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          {title}
        </h1>
        <p className="text-white/90 text-hero-shadow-strong">
          {description}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <UXButton
            variant="primary"
            size="lg"
            onClick={() => reset()}
          >
            Try this step again
          </UXButton>
          <UXButton
            variant="outline"
            size="md"
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={handleStartOver}
          >
            ← Back to start
          </UXButton>
        </div>

        <div className="mt-6 max-w-lg mx-auto text-left bg-ux-background-secondary/80 border border-ux-border rounded-lg p-4">
          <p className="text-xs text-ux-text-secondary mb-1">
            Something feel off in this new UX flow?
          </p>
          <UXErrorFeedback
            context={isDemo ? 'demo' : 'flow'}
            hint="Optional: Share a quick note so we can improve this step."
          />
        </div>
      </div>
    </UXSection>
  )
}



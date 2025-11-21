"use client"

import { useRouter } from 'next/navigation'
import { UXSection, UXButton, UXErrorFeedback } from '@/components/ux'

export default function UXDemoSampleError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  return (
    <UXSection>
      <div className="max-w-xl mx-auto text-center space-y-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[0.5px] text-hero-shadow leading-tight">
          The demo didn&apos;t load as expected
        </h1>
        <p className="text-white/90 text-hero-shadow-strong">
          An error occurred while preparing the sample menus. You can retry this demo or head back to the main UX page.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
          <UXButton
            variant="primary"
            size="lg"
            onClick={() => reset()}
          >
            Try the demo again
          </UXButton>
          <UXButton
            variant="outline"
            size="md"
            className="bg-white/20 border-white/40 text-white hover:bg-white/30"
            onClick={() => router.push('/ux')}
          >
            ← Back to UX home
          </UXButton>
        </div>

        <div className="mt-6 max-w-lg mx-auto text-left bg-ux-background-secondary/80 border border-ux-border rounded-lg p-4">
          <p className="text-xs text-ux-text-secondary mb-1">
            Help us understand what went wrong in the demo.
          </p>
          <UXErrorFeedback
            context="demo"
            hint="Optional: Tell us which sample you picked or what you expected to see."
          />
        </div>
      </div>
    </UXSection>
  )
}



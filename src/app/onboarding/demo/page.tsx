'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui'

interface DemoStep {
  key: string
  title: string
  description: string
}

const DEMO_STEPS: DemoStep[] = [
  { key: 'select', title: 'Pick a sample photo', description: 'Choose a sample menu photo to simulate an upload.' },
  { key: 'review', title: 'Review items', description: 'Toggle availability and adjust prices if needed.' },
  { key: 'publish', title: 'Publish & QR', description: 'Finish the flow and view a sample QR.' },
]

const PLACEHOLDER_A = 'https://placehold.co/600x400?text=Sample+Photo+A'
const PLACEHOLDER_B = 'https://placehold.co/600x400?text=Sample+Photo+B'

const SAMPLE_ITEMS = [
  'Chicken Rice — $8.50',
  'Beef Noodles — $12.00',
  'Iced Coffee — $3.50',
]

function buildDemoPublicUrl() {
  if (typeof window === 'undefined') return '#'
  const base = window.location.origin.replace(/\/$/, '')
  return `${base}/onboarding/demo/menu`
}

export default function OnboardingDemoPage() {
  const [step, setStep] = useState(0)
  const [selected, setSelected] = useState<'A' | 'B' | null>(null)
  const qrUrl = useMemo(() => buildDemoPublicUrl(), [])

  return (
    <div className="min-h-screen bg-secondary-50">
      <header className="bg-white shadow-sm">
        <div className="container-mobile py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-secondary-900">Demo walkthrough</h1>
            <Link href="/onboarding" className="text-sm text-secondary-600 hover:text-secondary-900">Exit</Link>
          </div>
        </div>
      </header>

      <main className="container-mobile py-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                {DEMO_STEPS.map((s, idx) => (
                  <li key={s.key} className="flex items-center gap-3">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium ${idx <= step ? 'bg-primary-100 text-primary-800' : 'bg-secondary-200 text-secondary-700'}`}>{idx+1}</span>
                    <div>
                      <div className="text-sm font-medium text-secondary-900">{s.title}</div>
                      <div className="text-xs text-secondary-600">{s.description}</div>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              {step === 0 && (
                <div className="space-y-4">
                  <p className="text-secondary-700 text-center">Choose a sample image to continue</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <button
                      className={`overflow-hidden rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 ${selected==='A' ? 'ring-2 ring-primary-500' : ''}`}
                      onClick={() => { setSelected('A'); setStep(1) }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={PLACEHOLDER_A}
                        alt="Sample Photo A"
                        className="w-full h-40 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="p-3 text-center text-sm">Sample Photo A</div>
                    </button>
                    <button
                      className={`overflow-hidden rounded-lg border focus:outline-none focus:ring-2 focus:ring-primary-500 ${selected==='B' ? 'ring-2 ring-primary-500' : ''}`}
                      onClick={() => { setSelected('B'); setStep(1) }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={PLACEHOLDER_B}
                        alt="Sample Photo B"
                        className="w-full h-40 object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                      <div className="p-3 text-center text-sm">Sample Photo B</div>
                    </button>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-secondary-700">Extracted items (demo):</p>
                  <ul className="text-sm text-secondary-800 list-disc pl-5">
                    {SAMPLE_ITEMS.map(x => (
                      <li key={x}>{x}</li>
                    ))}
                  </ul>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(0)}>Back</Button>
                    <Button onClick={() => setStep(2)}>Publish</Button>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="text-center">
                  <p className="text-secondary-700 mb-3">Published! Here’s a sample QR code.</p>
                  <div className="flex justify-center">
                    {/* Render QR via Google Chart API for zero-dep preview */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=${encodeURIComponent(qrUrl)}`}
                      alt="Sample QR linking to demo menu"
                      className="h-40 w-40"
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="mt-6">
                    <Link href="/dashboard" className="btn btn-primary">Finish</Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}



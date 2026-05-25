'use client'

/**
 * Prompt Review Tool
 *
 * Lets an admin configure the same inputs as the /extracted image generation
 * modal and inspect the exact prompt that buildPromptV2 would produce —
 * without sending anything to the image generation API.
 *
 * "Focus variable" mode: pick one variable (angle, lighting, background,
 * plating colour) and the tool renders a side-by-side comparison of every
 * possible value for that variable, holding all other inputs constant.
 */

import { useMemo, useState } from 'react'
import { PromptConstructionService } from '@/lib/prompt-construction'
import type { PhotoGenerationParams, PlatingColour } from '@/types'

// ---------------------------------------------------------------------------
// Sample menu items for quick testing
// ---------------------------------------------------------------------------

interface SampleItem {
  id: string
  label: string
  name: string
  description: string
  category: string
}

const SAMPLE_ITEMS: SampleItem[] = [
  {
    id: 'salmon',
    label: 'Grilled Salmon',
    name: 'Grilled Salmon',
    description: 'Pan-seared Atlantic salmon fillet with a herb crust, served with wilted spinach, roasted cherry tomatoes, and a lemon beurre blanc.',
    category: 'Mains',
  },
  {
    id: 'pizza',
    label: 'Margherita Pizza',
    name: 'Margherita Pizza',
    description: 'Thin-crust Neapolitan pizza with San Marzano tomato sauce, fresh buffalo mozzarella, and torn basil leaves, finished with extra-virgin olive oil.',
    category: 'Pizza',
  },
  {
    id: 'ramen',
    label: 'Tonkotsu Ramen',
    name: 'Tonkotsu Ramen',
    description: 'Rich pork bone broth with wavy ramen noodles, chashu pork belly, soft-boiled marinated egg, nori, bamboo shoots, and spring onion.',
    category: 'Noodles',
  },
  {
    id: 'cheesecake',
    label: 'New York Cheesecake',
    name: 'New York Cheesecake',
    description: 'Creamy baked cheesecake on a buttery graham cracker base, topped with a fresh strawberry compote and a dusting of icing sugar.',
    category: 'Desserts',
  },
  {
    id: 'latte',
    label: 'Flat White',
    name: 'Flat White',
    description: 'Double ristretto espresso with velvety steamed whole milk, served in a ceramic cup with a simple rosette latte art.',
    category: 'Drinks',
  },
  {
    id: 'burger',
    label: 'Smash Burger',
    name: 'Smash Burger',
    description: 'Double smashed beef patties with American cheese, caramelised onions, pickles, and house burger sauce in a toasted brioche bun.',
    category: 'Burgers',
  },
  {
    id: 'laksa',
    label: 'Prawn Laksa',
    name: 'Prawn Laksa',
    description: 'Spicy coconut curry broth with thick rice noodles, tiger prawns, fish cake, bean sprouts, halved boiled egg, and fresh laksa leaves.',
    category: 'Soups',
  },
  {
    id: 'custom',
    label: '— Custom —',
    name: '',
    description: '',
    category: '',
  },
]

// ---------------------------------------------------------------------------
// Variable definitions — mirrors the options in GeneratePhotoModal
// ---------------------------------------------------------------------------

type FocusVariable = 'angle' | 'lighting' | 'hasBackground' | 'platingColour'

interface VariableOption<T> {
  value: T
  label: string
}

const ANGLE_OPTIONS: VariableOption<PhotoGenerationParams['angle']>[] = [
  { value: 'overhead', label: 'Overhead (flat lay)' },
  { value: '45', label: '45° Angle (natural)' },
  { value: 'front', label: 'Front (eye-level)' },
]

const LIGHTING_OPTIONS: VariableOption<PhotoGenerationParams['lighting']>[] = [
  { value: 'natural', label: 'Natural' },
  { value: 'studio', label: 'Studio' },
  { value: 'moody', label: 'Moody' },
]

const BACKGROUND_OPTIONS: VariableOption<boolean>[] = [
  { value: false, label: 'No background image' },
  { value: true, label: 'Background image set' },
]

const PLATING_OPTIONS: VariableOption<PlatingColour>[] = [
  { value: 'white', label: 'White plate' },
  { value: 'beige', label: 'Beige plate (default)' },
  { value: 'black', label: 'Black plate' },
  { value: 'none', label: 'None (no plate)' },
]

const ESTABLISHMENT_TYPES = [
  { value: '', label: 'Default' },
  { value: 'fine-dining', label: 'Fine Dining' },
  { value: 'cafe-brunch', label: 'Café / Brunch' },
  { value: 'bakery-dessert', label: 'Bakery / Dessert' },
  { value: 'hawker-foodcourt', label: 'Hawker / Food Court' },
  { value: 'casual-dining', label: 'Casual Dining' },
  { value: 'bar-pub', label: 'Bar / Pub' },
]

const CUISINE_TYPES = [
  { value: '', label: 'Default' },
  { value: 'local-sg', label: 'Singaporean / Hawker' },
  { value: 'peranakan', label: 'Peranakan' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'italian', label: 'Italian' },
  { value: 'korean', label: 'Korean' },
  { value: 'thai-viet', label: 'Thai / Vietnamese' },
  { value: 'mexican', label: 'Mexican' },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const service = new PromptConstructionService()

/** Stub data URL used when "background image set" is selected */
const STUB_REFERENCE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

function buildParams(
  base: BaseParams,
  overrides: Partial<PhotoGenerationParams>
): PhotoGenerationParams {
  return {
    angle: base.angle,
    lighting: base.lighting,
    platingColour: base.platingColour,
    settingReferenceImage: base.hasBackground ? STUB_REFERENCE : undefined,
    establishmentType: base.establishmentType || undefined,
    primaryCuisine: base.primaryCuisine || undefined,
    itemCategory: base.itemCategory || undefined,
    ...overrides,
  }
}

function buildMenuItem(name: string, description: string, category: string) {
  return {
    id: 'preview',
    name: name || 'Unnamed Item',
    description: description || undefined,
    price: 0,
    available: true,
    category: category || undefined,
    order: 0,
    imageSource: 'none' as const,
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BaseParams {
  angle: PhotoGenerationParams['angle']
  lighting: PhotoGenerationParams['lighting']
  platingColour: PlatingColour
  hasBackground: boolean
  establishmentType: string
  primaryCuisine: string
  itemCategory: string
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PromptCard({ label, prompt }: { label: string; prompt: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{label}</span>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 hover:text-gray-800 transition-colors px-2 py-1 rounded hover:bg-gray-200"
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs text-gray-800 whitespace-pre-wrap leading-relaxed font-mono">
        {prompt}
      </pre>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
      {children}
    </p>
  )
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div>
      <SectionLabel>{label}</SectionLabel>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accordion card
// ---------------------------------------------------------------------------

type PanelId = 'base' | 'focus' | 'item' | 'venue'

function AccordionCard({
  id,
  title,
  summary,
  openId,
  onOpen,
  children,
}: {
  id: PanelId
  title: string
  summary: string
  openId: PanelId | null
  onOpen: (id: PanelId) => void
  children: React.ReactNode
}) {
  const isOpen = openId === id
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onOpen(isOpen ? (null as any) : id)}
        className="w-full flex items-center justify-between px-5 py-4 text-left group"
      >
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{title}</h2>
          {!isOpen && (
            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{summary}</p>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-transform flex-shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && <div className="px-5 pb-5 space-y-4 border-t border-gray-100">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PromptReviewClient() {
  // Item selection
  const [selectedSampleId, setSelectedSampleId] = useState<string>('salmon')
  const [customName, setCustomName] = useState('')
  const [customDescription, setCustomDescription] = useState('')
  const [customCategory, setCustomCategory] = useState('')

  // Base params (the "fixed" values when a focus variable is selected)
  const [base, setBase] = useState<BaseParams>({
    angle: '45',
    lighting: 'natural',
    platingColour: 'beige',
    hasBackground: false,
    establishmentType: '',
    primaryCuisine: '',
    itemCategory: '',
  })

  // Focus variable
  const [focusVariable, setFocusVariable] = useState<FocusVariable>('platingColour')

  // Accordion — null means all collapsed (default)
  const [openPanel, setOpenPanel] = useState<PanelId | null>(null)

  // Resolved item
  const selectedSample = SAMPLE_ITEMS.find((s) => s.id === selectedSampleId) ?? SAMPLE_ITEMS[0]
  const isCustom = selectedSampleId === 'custom'

  const itemName = isCustom ? customName : selectedSample.name
  const itemDescription = isCustom ? customDescription : selectedSample.description
  const itemCategory = base.itemCategory || (isCustom ? customCategory : selectedSample.category)

  const menuItem = useMemo(
    () => buildMenuItem(itemName, itemDescription, itemCategory),
    [itemName, itemDescription, itemCategory]
  )

  // Single-prompt preview (all base params, no focus variable expansion)
  const singlePrompt = useMemo(() => {
    try {
      const params = buildParams(base, {})
      return service.buildPromptV2(menuItem, params).prompt
    } catch {
      return '(error building prompt)'
    }
  }, [menuItem, base])

  // Focus variable expansion
  const focusResults = useMemo(() => {
    try {
      switch (focusVariable) {
        case 'angle':
          return ANGLE_OPTIONS.map((opt) => ({
            label: opt.label,
            prompt: service.buildPromptV2(menuItem, buildParams(base, { angle: opt.value })).prompt,
          }))
        case 'lighting':
          return LIGHTING_OPTIONS.map((opt) => ({
            label: opt.label,
            prompt: service.buildPromptV2(menuItem, buildParams(base, { lighting: opt.value })).prompt,
          }))
        case 'hasBackground':
          return BACKGROUND_OPTIONS.map((opt) => ({
            label: opt.label,
            prompt: service.buildPromptV2(
              menuItem,
              buildParams(base, {
                settingReferenceImage: opt.value ? STUB_REFERENCE : undefined,
              })
            ).prompt,
          }))
        case 'platingColour':
          return PLATING_OPTIONS.map((opt) => ({
            label: opt.label,
            prompt: service.buildPromptV2(menuItem, buildParams(base, { platingColour: opt.value })).prompt,
          }))
        default:
          return []
      }
    } catch {
      return []
    }
  }, [focusVariable, menuItem, base])

  // Summaries shown on collapsed card headers
  const ANGLE_LABEL = ANGLE_OPTIONS.find((o) => o.value === base.angle)?.label ?? base.angle
  const LIGHTING_LABEL = LIGHTING_OPTIONS.find((o) => o.value === base.lighting)?.label ?? base.lighting
  const PLATING_LABEL = PLATING_OPTIONS.find((o) => o.value === base.platingColour)?.label ?? base.platingColour
  const FOCUS_LABEL = {
    angle: 'Angle',
    lighting: 'Lighting',
    hasBackground: 'Background',
    platingColour: 'Plating Colour',
  }[focusVariable]

  const baseSummary = `${ANGLE_LABEL} · ${LIGHTING_LABEL} · ${PLATING_LABEL} · ${base.hasBackground ? 'BG set' : 'No BG'}`
  const focusSummary = `Focused on: ${FOCUS_LABEL}`
  const itemSummary = isCustom ? (customName || 'Custom item') : selectedSample.name
  const venueSummary =
    [
      ESTABLISHMENT_TYPES.find((e) => e.value === base.establishmentType)?.label,
      CUISINE_TYPES.find((c) => c.value === base.primaryCuisine)?.label,
    ]
      .filter((v) => v && v !== 'Default')
      .join(' · ') || 'Default'

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Prompt Review</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Inspect V2 prompts without triggering image generation
            </p>
          </div>
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            ← Admin Hub
          </a>
        </div>
      </header>

      <div className="max-w-screen-xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-8 items-start">
        {/* ---------------------------------------------------------------- */}
        {/* LEFT PANEL — configuration                                        */}
        {/* ---------------------------------------------------------------- */}
        <aside className="space-y-3 lg:sticky lg:top-[73px]">

          {/* 1. Base Parameters */}
          <AccordionCard
            id="base"
            title="Base Parameters"
            summary={baseSummary}
            openId={openPanel}
            onOpen={setOpenPanel}
          >
            <p className="text-xs text-gray-500 pt-1">
              Fixed values. The focused variable overrides the relevant one.
            </p>
            <SelectField
              label="Angle"
              value={base.angle}
              onChange={(v) => setBase((b) => ({ ...b, angle: v as BaseParams['angle'] }))}
              options={ANGLE_OPTIONS}
            />
            <SelectField
              label="Lighting"
              value={base.lighting}
              onChange={(v) => setBase((b) => ({ ...b, lighting: v as BaseParams['lighting'] }))}
              options={LIGHTING_OPTIONS}
            />
            <SelectField
              label="Plating colour"
              value={base.platingColour}
              onChange={(v) => setBase((b) => ({ ...b, platingColour: v as PlatingColour }))}
              options={PLATING_OPTIONS}
            />
            <div>
              <SectionLabel>Background image</SectionLabel>
              <div className="flex gap-2">
                {BACKGROUND_OPTIONS.map((opt) => (
                  <button
                    key={String(opt.value)}
                    onClick={() => setBase((b) => ({ ...b, hasBackground: opt.value }))}
                    className={`flex-1 text-xs px-3 py-2 rounded-lg border transition-all ${
                      base.hasBackground === opt.value
                        ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </AccordionCard>

          {/* 2. Focus Variable */}
          <AccordionCard
            id="focus"
            title="Focus Variable"
            summary={focusSummary}
            openId={openPanel}
            onOpen={setOpenPanel}
          >
            <p className="text-xs text-gray-500 pt-1">
              The right panel shows one prompt per option for this variable, all others held constant.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { id: 'angle', label: 'Angle' },
                  { id: 'lighting', label: 'Lighting' },
                  { id: 'hasBackground', label: 'Background' },
                  { id: 'platingColour', label: 'Plating Colour' },
                ] as { id: FocusVariable; label: string }[]
              ).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setFocusVariable(v.id)}
                  className={`text-xs px-3 py-2.5 rounded-lg border transition-all font-medium ${
                    focusVariable === v.id
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </AccordionCard>

          {/* 3. Menu Item */}
          <AccordionCard
            id="item"
            title="Menu Item"
            summary={itemSummary}
            openId={openPanel}
            onOpen={setOpenPanel}
          >
            <div className="pt-1">
              <SectionLabel>Quick select</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {SAMPLE_ITEMS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSampleId(s.id)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-all text-left ${
                      selectedSampleId === s.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700 font-semibold'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {isCustom ? (
              <div className="space-y-3">
                <div>
                  <SectionLabel>Item name</SectionLabel>
                  <input
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="e.g. Truffle Pasta"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
                <div>
                  <SectionLabel>Description</SectionLabel>
                  <textarea
                    value={customDescription}
                    onChange={(e) => setCustomDescription(e.target.value)}
                    placeholder="Describe the dish…"
                    rows={3}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
                  />
                </div>
                <div>
                  <SectionLabel>Category</SectionLabel>
                  <input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="e.g. Pasta, Burgers, Drinks…"
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-gray-50 border border-gray-100 p-3 space-y-1">
                  <p className="text-xs font-semibold text-gray-700">{selectedSample.name}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{selectedSample.description}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                    Category: {selectedSample.category}
                  </p>
                </div>
                <div>
                  <SectionLabel>Category override (optional)</SectionLabel>
                  <input
                    value={base.itemCategory}
                    onChange={(e) => setBase((b) => ({ ...b, itemCategory: e.target.value }))}
                    placeholder={`Default: ${selectedSample.category}`}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"
                  />
                </div>
              </>
            )}
          </AccordionCard>

          {/* 4. Venue Context */}
          <AccordionCard
            id="venue"
            title="Venue Context"
            summary={venueSummary}
            openId={openPanel}
            onOpen={setOpenPanel}
          >
            <div className="pt-1 space-y-4">
              <SelectField
                label="Establishment type"
                value={base.establishmentType}
                onChange={(v) => setBase((b) => ({ ...b, establishmentType: v }))}
                options={ESTABLISHMENT_TYPES}
              />
              <SelectField
                label="Primary cuisine"
                value={base.primaryCuisine}
                onChange={(v) => setBase((b) => ({ ...b, primaryCuisine: v }))}
                options={CUISINE_TYPES}
              />
            </div>
          </AccordionCard>

        </aside>

        {/* ---------------------------------------------------------------- */}
        {/* RIGHT PANEL — prompt output                                       */}
        {/* ---------------------------------------------------------------- */}
        <main className="space-y-8">
          {/* Single prompt preview */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Single Prompt Preview
              </h2>
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                base params only
              </span>
            </div>
            <PromptCard label={`${itemName || 'Item'} — all base params`} prompt={singlePrompt} />
          </section>

          {/* Focus variable expansion */}
          <section>
            <div className="flex items-center gap-3 mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
                Focus: {focusVariable === 'hasBackground' ? 'Background Image' : focusVariable === 'platingColour' ? 'Plating Colour' : focusVariable.charAt(0).toUpperCase() + focusVariable.slice(1)}
              </h2>
              <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider">
                {focusResults.length} variants
              </span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              All other parameters are held at their base values. Differences between cards are caused solely by the focused variable.
            </p>
            <div className="space-y-4">
              {focusResults.map((r) => (
                <PromptCard key={r.label} label={r.label} prompt={r.prompt} />
              ))}
            </div>
          </section>

          {/* Diff hint */}
          <section className="rounded-xl border border-dashed border-gray-300 bg-white p-5">
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
              Tip — spotting differences
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Copy two prompts and paste them into a diff tool (e.g.{' '}
              <a
                href="https://www.diffchecker.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                diffchecker.com
              </a>
              ) to highlight exactly which clauses change between variants. This is the fastest way to verify that only the intended variable is affecting the output.
            </p>
          </section>
        </main>
      </div>
    </div>
  )
}

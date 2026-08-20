/**
 * @jest-environment node
 *
 * Task 19.10 — Group B integration coverage.
 *
 * These tests use the real Studio route, descriptor, mutation engine, and
 * request builder. External Gemini/Supabase/storage boundaries are replaced
 * with in-memory doubles; no database migration or destructive command runs.
 */

import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockRequireStudioApi = jest.fn()
const mockRequireAdminApi = jest.fn()
const mockGetStudioDish = jest.fn()
const mockSetCurrentImage = jest.fn()
const mockLoadStudioImageBytes = jest.fn()
const mockRegisterSource = jest.fn()
const mockUpdateMetadata = jest.fn()
const mockPersist = jest.fn()
const mockCountToday = jest.fn()
const mockRunValidation = jest.fn()
const mockAssertCanAfford = jest.fn()
const mockDebit = jest.fn()
const mockGetCreditCost = jest.fn()
const mockAssertDishNotBlocked = jest.fn()
const mockRecordFailure = jest.fn()
const mockRecordSuccess = jest.fn()
const mockIsBillable = jest.fn()
const mockExtract = jest.fn()
const mockFetchJsonWithRetry = jest.fn()
let migrationMissing = false

const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const SOURCE_BYTES = Buffer.from(TINY_PNG_BASE64, 'base64')
const GENERATED_BASE64 = Buffer.from('generated-studio-image').toString('base64')
const API_RESPONSE = {
  candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: GENERATED_BASE64 } }] } }],
  metadata: { model_version: 'integration-test', processing_time_ms: 1 },
}

const styleRows: Record<string, Record<string, unknown>> = {}

function resetStyleRows(): void {
  styleRows['bright-clean'] = {
    id: 'lighting-bright-clean', key: 'bright-clean', name: 'Bright & Clean',
    short_description: 'Clean commercial studio light',
    prompt_fragment: 'Apply clean commercial studio light.',
    negative_constraints: 'Do not add props.',
    descriptor: { quality: 'clean commercial studio light', temperature: 'neutral', shadows: 'soft, controlled shadows', falloff: 'gradual' },
    is_active: true,
  }
  styleRows['warm-sand'] = {
    id: 'backdrop-warm-sand', key: 'warm-sand', name: 'Warm Sand', category: 'backdrop',
    short_description: 'Warm muted sand-toned background',
    prompt_fragment: 'Replace the backdrop with warm sand.', negative_constraints: 'Do not change the dish.',
    descriptor: { appearance: 'warm muted sand-toned studio backdrop', colour: '#CDBA9C', falloff: 'soft, professional studio lighting' }, is_active: true,
  }
  styleRows['dark-stone'] = {
    id: 'surface-dark-stone', key: 'dark-stone', name: 'Dark Stone', category: 'surface',
    short_description: 'Dark stone tabletop', prompt_fragment: 'Use a dark stone tabletop.',
    negative_constraints: 'Do not add props.',
    descriptor: { material: 'dark stone', finish: 'honed matte with subtle natural texture', colour: '#2E3338' }, is_active: true,
  }
}

function styleTable(table: string) {
  return {
    select: (_columns: string) => {
      const filters: Array<[string, unknown]> = []
      const query = {
        eq: (field: string, value: unknown) => {
          filters.push([field, value])
          return query
        },
        maybeSingle: async () => {
          if (migrationMissing) return { data: null, error: { message: `column ${table}.descriptor does not exist` } }
          const row = Object.values(styleRows).find((candidate) =>
            filters.every(([field, value]) => candidate[field] === value),
          )
          return { data: row ? { ...row } : null, error: null }
        },
      }
      return query
    },
  }
}

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))
jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: () => mockRequireAdminApi(),
}))
jest.mock('@/lib/studio/dishes', () => ({
  getStudioDish: (...args: unknown[]) => mockGetStudioDish(...args),
  setStudioDishCurrentImage: (...args: unknown[]) => mockSetCurrentImage(...args),
}))
jest.mock('@/lib/studio/image-bytes', () => ({
  loadStudioImageBytes: (...args: unknown[]) => mockLoadStudioImageBytes(...args),
  StudioImageLoadError: class StudioImageLoadError extends Error { status = 400 },
}))
jest.mock('@/lib/studio/persistence', () => ({
  registerStudioSourceImage: (...args: unknown[]) => mockRegisterSource(...args),
  persistStudioImage: (...args: unknown[]) => mockPersist(...args),
  countTodayGeneratedStudioImages: (...args: unknown[]) => mockCountToday(...args),
  getStudioDailyGenerationLimit: () => 25,
  StudioImageLoadError: class StudioImageLoadError extends Error { status = 400 },
}))
jest.mock('@/lib/studio/library', () => ({
  updateStudioImageMetadata: (...args: unknown[]) => mockUpdateMetadata(...args),
}))
jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({ from: (table: string) => styleTable(table) }),
}))
jest.mock('@/lib/photo-control/gemini-extraction-client', () => ({
  GeminiExtractionClient: jest.fn().mockImplementation(() => ({ extract: (...args: unknown[]) => mockExtract(...args) })),
  UnparseableExtractionResponseError: class UnparseableExtractionResponseError extends Error { code = 'UNPARSEABLE_EXTRACTION_RESPONSE' },
}))
jest.mock('@/lib/retry', () => {
  const actual = jest.requireActual('@/lib/retry')
  return { ...actual, fetchJsonWithRetry: (...args: unknown[]) => mockFetchJsonWithRetry(...args) }
})
jest.mock('@/lib/studio/credits', () => ({
  assertCanAffordStudioCredits: (...args: unknown[]) => mockAssertCanAfford(...args),
  debitForStudioGeneration: (...args: unknown[]) => mockDebit(...args),
  getCreditCostForModel: (...args: unknown[]) => mockGetCreditCost(...args),
  StudioCreditsError: class StudioCreditsError extends Error { code = 'INSUFFICIENT_CREDITS'; status = 402 },
}))
jest.mock('@/lib/studio/generation-failures', () => ({
  assertDishNotBlocked: (...args: unknown[]) => mockAssertDishNotBlocked(...args),
  recordBillableGenerationFailure: (...args: unknown[]) => mockRecordFailure(...args),
  recordGenerationSuccess: (...args: unknown[]) => mockRecordSuccess(...args),
  isBillableProviderFailure: (...args: unknown[]) => mockIsBillable(...args),
  StudioDishBlockedError: class StudioDishBlockedError extends Error { code = 'STUDIO_DISH_GENERATION_BLOCKED'; status = 423; failureCount = 1 },
}))
jest.mock('@/lib/studio/output-validation', () => ({
  runStudioOutputValidation: (...args: unknown[]) => mockRunValidation(...args),
  validationToMetadata: (value: unknown) => value,
}))

import { POST as sourcePOST } from '../source/route'
import { POST as extractPOST } from '../extract/route'
import { POST as mutatePOST } from '../mutate/route'
import { StudioClient } from '@/app/studio/_components/studio-client'
import { resolveLightingStyle } from '@/lib/studio/reference-libraries'
import { MutationEngine, type StyleReferenceImage } from '@/lib/photo-control/mutation-engine'
import { buildSceneDescriptor } from '@/lib/photo-control/scene-descriptor'
import { composePrompt } from '@/lib/photo-control/prompt-composer'
import { computeDelta } from '@/lib/photo-control/state-delta'
import { MinimalSchemaZ, type MinimalSchema } from '@/lib/photo-control/minimal-schema'
import { CENTER } from '@/lib/photo-control/minimal-schema'
import { logger } from '@/lib/logger'

function request(url: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const originalState: MinimalSchema = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft-natural', spin: '0' },
  canvas: { background: 'visible studio wall', background_style: '', surface_style: '', main_vessel: 'ceramic plate' },
  food_components: { main_item: 'Hainanese chicken rice', garnishes: ['cucumber'], sides: ['chilli sauce'] },
}

const targetState: MinimalSchema = {
  scene_setup: { ...originalState.scene_setup, lighting: 'bright-clean' },
  canvas: { ...originalState.canvas, background_style: 'warm-sand', surface_style: 'dark-stone' },
  food_components: { ...originalState.food_components },
}

const extraction = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft-natural', spin: '0' },
  canvas: { background: 'visible studio wall', background_style: '', surface_style: '', main_vessel: 'ceramic plate' },
  food_components: { main_item: 'Hainanese chicken rice', garnishes: ['cucumber'], sides: ['chilli sauce'] },
}

function extractDescriptor(prompt: string): Record<string, any> {
  const start = prompt.indexOf('{')
  if (start < 0) throw new Error(`Descriptor JSON missing from prompt: ${prompt}`)

  let depth = 0
  let inString = false
  let escaped = false
  for (let index = start; index < prompt.length; index += 1) {
    const character = prompt[index]
    if (inString) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') inString = false
      continue
    }
    if (character === '"') inString = true
    else if (character === '{') depth += 1
    else if (character === '}') {
      depth -= 1
      if (depth === 0) return JSON.parse(prompt.slice(start, index + 1)) as Record<string, any>
    }
  }

  throw new Error(`Unterminated descriptor JSON: ${prompt}`)
}

function capturedRequestBody(): any {
  const [, init] = mockFetchJsonWithRetry.mock.calls.at(-1) as [string, RequestInit]
  return JSON.parse(init.body as string)
}

function inlineImages(body: any): Array<{ data: string; mimeType: string }> {
  return body.contents[0].parts
    .filter((part: any) => part.inlineData)
    .map((part: any) => part.inlineData)
}

function styleReference(name: string, data = TINY_PNG_BASE64): StyleReferenceImage {
  return { data, mimeType: 'image/png', role: name === 'backdrop' ? 'scene' : 'style', comment: `${name} reference` }
}

beforeEach(() => {
  jest.clearAllMocks()
  migrationMissing = false
  resetStyleRows()
  process.env.NANO_BANANA_API_KEY = 'group-b-integration-key'
  delete process.env.STUDIO_MAX_REFS
  delete process.env.STUDIO_THINKING_LEVEL
  mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'customer-1' }, supabase: {} })
  mockRequireAdminApi.mockResolvedValue({ ok: true, user: { id: 'admin-1' }, supabase: {} })
  mockGetStudioDish.mockResolvedValue({ id: 'dish-1', name: 'Hainanese chicken rice', generation_failure_count: 0, generation_blocked_at: null })
  mockSetCurrentImage.mockResolvedValue({ id: 'dish-1' })
  mockLoadStudioImageBytes.mockResolvedValue({ mimeType: 'image/png', base64: TINY_PNG_BASE64, byteLength: SOURCE_BYTES.length })
  mockRegisterSource.mockResolvedValue({ id: 'source-1', dish_id: 'dish-1', public_url: 'https://cdn.test/source.png' })
  mockUpdateMetadata.mockResolvedValue({})
  mockPersist.mockResolvedValue({ id: 'generated-1', dish_id: 'dish-1', public_url: 'https://cdn.test/generated.png' })
  mockCountToday.mockResolvedValue(0)
  mockAssertCanAfford.mockResolvedValue(10)
  mockDebit.mockResolvedValue({ cost: 1, balanceAfter: 9, ledgerId: 'ledger-1' })
  mockGetCreditCost.mockReturnValue(1)
  mockAssertDishNotBlocked.mockImplementation(() => undefined)
  mockRecordSuccess.mockResolvedValue(undefined)
  mockRecordFailure.mockResolvedValue({ generation_failure_count: 1, generation_blocked_at: null })
  mockIsBillable.mockReturnValue(true)
  mockRunValidation.mockResolvedValue({ status: 'pass', score: 100, summary: 'validated', dimensions: [] })
  mockExtract.mockResolvedValue({ raw: extraction })
  mockFetchJsonWithRetry.mockResolvedValue(API_RESPONSE)
})

describe('Task 19.10 — customer FOH source → extract → staged mutate', () => {
  /** **Validates: Requirements 2.3b, 2.9, 2.18a, 3.10, 3.13** */
  it('keeps the source as the only identity reference and carries all three staged styles in target', async () => {
    const sourceResponse = await sourcePOST(request('/api/studio/source', {
      imageId: 'source-1', dishId: 'dish-1', mimeType: 'image/png',
    }))
    expect(sourceResponse.status).toBe(200)

    const extractResponse = await extractPOST(request('/api/studio/extract', { imageId: 'source-1' }))
    expect(extractResponse.status).toBe(200)
    const extracted = await extractResponse.json()
    expect(extracted.data).toEqual(extraction)

    const mutateResponse = await mutatePOST(request('/api/studio/mutate', {
      dishId: 'dish-1', sourceImageId: 'source-1', originalState, targetState,
      directive: 'Apply the staged lighting, backdrop, and tabletop surface while preserving the dish.',
      changeSummary: ['Bright & Clean', 'Warm Sand', 'Dark Stone'],
      extractionDiagnostics: extracted.diagnostics,
    }))

    expect(mutateResponse.status).toBe(200)
    const responseBody = await mutateResponse.json()
    expect(responseBody).not.toHaveProperty('validation')

    const body = capturedRequestBody()
    const refs = inlineImages(body)
    expect(refs).toHaveLength(1)
    expect(refs[0]).toEqual({ mimeType: 'image/png', data: TINY_PNG_BASE64 })
    expect(Buffer.from(refs[0].data, 'base64')).toEqual(SOURCE_BYTES)
    expect(body.generationConfig.imageConfig).not.toHaveProperty('aspectRatio')
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingLevel: 'HIGH' })

    const descriptor = extractDescriptor(body.contents[0].parts[0].text)
    expect(descriptor.subject.reference).toBeUndefined()
    expect(descriptor.target.lighting).toEqual({
      quality: 'clean commercial studio light',
      temperature: 'neutral',
      shadows: 'soft, controlled shadows',
      falloff: 'gradual',
    })
    expect(descriptor.target.backdrop).toEqual({
      appearance: 'warm muted sand-toned studio backdrop',
      colour: '#CDBA9C',
      falloff: 'soft, professional studio lighting',
      mode: 'replace',
    })
    expect(descriptor.target.surface).toEqual({
      material: 'dark stone',
      finish: 'honed matte with subtle natural texture',
      colour: '#2E3338',
    })
    for (const section of [descriptor.target.lighting, descriptor.target.backdrop, descriptor.target.surface]) {
      expect(section).not.toHaveProperty('reference')
    }

    expect(mockPersist).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({ validation: expect.objectContaining({ status: 'pass' }) }),
    }))
  })

  it('keeps validation telemetry persisted while the customer response and FOH page expose no validation indicator', async () => {
    const response = await mutatePOST(request('/api/studio/mutate', {
      dishId: 'dish-1', sourceImageId: 'source-1', originalState,
      targetState: { ...originalState, scene_setup: { ...originalState.scene_setup, lighting: 'bright-clean' } },
      directive: 'Apply the staged lighting.',
    }))
    expect(response.status).toBe(200)
    expect(await response.json()).not.toHaveProperty('validation')
    expect(mockPersist.mock.calls[0][0].metadata.validation).toEqual(expect.objectContaining({ status: 'pass' }))

    const customerPageSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'app', 'studio', '_components', 'studio-client.tsx'),
      'utf8',
    )
    expect(customerPageSource).not.toContain('validation-indicator')
  })
})

describe('Task 19.10 — admin Photo Control multi-reference flow', () => {
  /** **Validates: Requirements 2.9, 2.10** */
  it('attaches source plus three fitted style references and names Images B/C/D once in the descriptor', async () => {
    const delta = computeDelta(
      { schema: originalState, position: CENTER },
      { schema: targetState, position: CENTER },
    )
    const descriptor = buildSceneDescriptor({
      original: originalState,
      target: targetState,
      delta,
      styles: {
        lighting: styleRows['bright-clean'] as any,
        backdrop: styleRows['warm-sand'] as any,
        surface: styleRows['dark-stone'] as any,
      },
      observations: {},
      labels: ['Image A', 'Image B', 'Image C', 'Image D'],
    })
    const promptResult = composePrompt({
      directive: 'Apply the three selected style references.',
      descriptor,
    })
    expect(promptResult.ok).toBe(true)
    if (!promptResult.ok) throw new Error(promptResult.error)

    await new MutationEngine().mutate({
      sourceImageBase64: TINY_PNG_BASE64,
      mimeType: 'image/png',
      prompt: promptResult.prompt,
      model: 'gemini-3.1-flash-image',
      styleReferences: [styleReference('lighting'), styleReference('backdrop'), styleReference('surface')],
    })

    const body = capturedRequestBody()
    expect(inlineImages(body)).toHaveLength(4)
    const requestDescriptor = extractDescriptor(body.contents[0].parts[0].text)
    expect(requestDescriptor.target.lighting.reference).toBe('Image B')
    expect(requestDescriptor.target.backdrop.reference).toBe('Image C')
    expect(requestDescriptor.target.surface.reference).toBe('Image D')
    expect(
      [requestDescriptor.target.lighting, requestDescriptor.target.backdrop, requestDescriptor.target.surface]
        .flatMap((section: any) => section.reference ? [section.reference] : []),
    ).toEqual(['Image B', 'Image C', 'Image D'])
  })

  it('fits or rejects an oversized swatch and names the rejected reference in a warning', async () => {
    const oversized = (await require('sharp')({
      create: { width: 2404, height: 2126, channels: 3, background: { r: 205, g: 186, b: 156 } },
    }).png().toBuffer() as Buffer).toString('base64')
    const warningSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined)

    try {
      await new MutationEngine().mutate({
        sourceImageBase64: TINY_PNG_BASE64,
        mimeType: 'image/png',
        prompt: 'Preserve the dish while applying the oversized backdrop swatch.',
        model: 'gemini-3.1-flash-image',
        styleReferences: [styleReference('oversized backdrop', oversized)],
      })
      const body = capturedRequestBody()
      const attached = inlineImages(body).slice(1)
      const warningText = JSON.stringify(warningSpy.mock.calls)
      const wasRejected = attached.length === 0 && warningText.includes('oversized backdrop reference')
      const wasFitted = attached.length === 1 && Buffer.from(attached[0].data, 'base64').length <= SOURCE_BYTES.length
      expect(wasRejected || wasFitted).toBe(true)
      expect(Buffer.from(inlineImages(body)[0].data, 'base64')).toEqual(SOURCE_BYTES)
    } finally {
      warningSpy.mockRestore()
    }
  })

  it('warns with every reference name dropped at the applied ten-reference cap', async () => {
    process.env.STUDIO_MAX_REFS = '10'
    const styleReferences = Array.from({ length: 14 }, (_, index) => styleReference(`cap-${index + 1}`))
    const warningSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined)

    try {
      await new MutationEngine().mutate({
        sourceImageBase64: TINY_PNG_BASE64,
        mimeType: 'image/png',
        prompt: 'Apply the selected admin references.',
        model: 'gemini-3.1-flash-image',
        styleReferences,
      })
      expect(inlineImages(capturedRequestBody())).toHaveLength(10)
      const warningText = JSON.stringify(warningSpy.mock.calls)
      for (const dropped of styleReferences.slice(9)) {
        expect(warningText).toContain(dropped.comment)
      }
    } finally {
      warningSpy.mockRestore()
    }
  })
})

describe('Task 19.10 — migration compatibility and Tier 1 preservation', () => {
  /** **Validates: Requirements 3.10** */
  it('successfully generates when migration 075 exists but the resolved style descriptor is null', async () => {
    styleRows['bright-clean'].descriptor = null
    styleRows['bright-clean'].short_description = 'Soft directional window light'
    styleRows['bright-clean'].prompt_fragment = 'Apply soft directional window light while preserving the dish.'

    const response = await mutatePOST(request('/api/studio/mutate', {
      dishId: 'dish-1', sourceImageId: 'source-1',
      originalState,
      targetState: { ...originalState, scene_setup: { ...originalState.scene_setup, lighting: 'bright-clean' } },
      directive: 'Apply the selected lighting style.',
    }))

    expect(response.status).toBe(200)
    const descriptor = extractDescriptor(capturedRequestBody().contents[0].parts[0].text)
    expect(descriptor.target.lighting).toEqual({
      quality: 'Soft directional window light',
    })
    expect(JSON.stringify(descriptor.target.lighting)).not.toContain('Apply soft directional window light')
    expect(JSON.stringify(descriptor.target.lighting)).not.toContain('Do not add props')
  })

  /** **Validates: Requirements 2.20, 2.24** */
  it('fails loudly when a descriptor read runs before migration 075', async () => {
    migrationMissing = true
    await expect(resolveLightingStyle('studio')).rejects.toThrow(
      'Failed to resolve lighting style: column studio_lighting_styles.descriptor does not exist',
    )
  })

  /** **Validates: Requirements 3.8** */
  it('keeps MinimalSchemaZ, enum tuples, and StateDelta byte-identical while descriptor data is additive', () => {
    expect(MinimalSchemaZ.keyof().options).toEqual(['scene_setup', 'canvas', 'food_components'])
    expect(MinimalSchemaZ.shape.scene_setup.keyof().options).toEqual(['angle', 'framing', 'lighting', 'spin'])
    expect(MinimalSchemaZ.shape.canvas.keyof().options).toEqual([
      'background', 'background_style', 'surface_style', 'main_vessel',
    ])
    expect(MinimalSchemaZ.shape.food_components.keyof().options).toEqual([
      'main_item', 'garnishes', 'sides',
    ])

    const { ANGLE_VALUES, FRAMING_VALUES, LIGHTING_VALUES, SPIN_VALUES } = require('@/lib/photo-control/minimal-schema')
    expect(ANGLE_VALUES).toEqual(['top-down', '45-degree', 'eye-level', 'macro-close-up'])
    expect(FRAMING_VALUES).toEqual(['close-up', 'medium', 'wide'])
    expect(LIGHTING_VALUES).toEqual(['bright-clean', 'bold-sunlight', 'soft-natural', 'golden-hour', 'dark-moody'])
    expect(SPIN_VALUES).toEqual(['0', 'left-45', 'right-45'])

    const beforeOriginal = JSON.stringify(originalState)
    const beforeTarget = JSON.stringify(targetState)
    const delta = computeDelta(
      { schema: originalState, position: CENTER },
      { schema: targetState, position: CENTER },
    )
    expect(JSON.stringify(delta)).toBe(
      '{"scalarChanges":[{"path":"scene_setup.lighting","from":"soft-natural","to":"bright-clean"},{"path":"canvas.background_style","from":"","to":"warm-sand"},{"path":"canvas.surface_style","from":"","to":"dark-stone"}],"arrays":{"garnishes":{"added":[],"removed":[]},"sides":{"added":[],"removed":[]}},"isEmpty":false}',
    )

    const descriptor = buildSceneDescriptor({
      original: originalState,
      target: targetState,
      delta,
      styles: {
        lighting: styleRows['bright-clean'] as any,
        backdrop: styleRows['warm-sand'] as any,
        surface: styleRows['dark-stone'] as any,
      },
      observations: {},
      labels: ['Image A'],
    })
    expect(JSON.stringify(originalState)).toBe(beforeOriginal)
    expect(JSON.stringify(targetState)).toBe(beforeTarget)
    expect(descriptor).toEqual(expect.objectContaining({ task: 'edit', subject: expect.any(Object), target: expect.any(Object) }))
    expect(descriptor).not.toEqual(originalState)
    expect(MinimalSchemaZ.safeParse(originalState).success).toBe(true)
    expect(MinimalSchemaZ.safeParse(targetState).success).toBe(true)
  })

  it('renders the customer component without a validation-indicator marker', () => {
    // The component is rendered with the same empty-gallery state used before
    // upload; effects are intentionally not run by server rendering.
    const customerPageSource = fs.readFileSync(
      path.join(process.cwd(), 'src', 'app', 'studio', '_components', 'studio-client.tsx'),
      'utf8',
    )
    expect(customerPageSource).not.toContain('validation-indicator')
    const markup = renderToStaticMarkup(React.createElement(StudioClient, {
      initialDishes: [{
        id: 'dish-1', user_id: 'customer-1', name: 'Dish', description: null,
        current_image_id: null, generation_failure_count: 0,
        generation_blocked_at: null, generation_blocked_reason: null,
        created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z',
      }],
      initialActiveDishId: 'dish-1',
      initialGallery: [],
      isAdmin: false,
    }))
    expect(markup).not.toContain('validation-indicator')
    expect(markup).not.toContain('Validation:')
  })
})

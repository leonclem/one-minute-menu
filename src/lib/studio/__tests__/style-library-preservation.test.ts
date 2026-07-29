/**
 * @jest-environment node
 */

import fc from 'fast-check'
import { NextRequest } from 'next/server'

const mockRequireStudioApi = jest.fn()
const mockRequireAdminApi = jest.fn()
const mockFetchJsonWithRetry = jest.fn()

type MockStyleRow = Record<string, unknown>
type MockStyleTable = 'studio_lighting_styles' | 'studio_background_styles'

let mockRows: Record<MockStyleTable, MockStyleRow[]>
let mockNextId = 1

jest.mock('@/lib/studio/studio-api-auth', () => ({
  requireStudioApi: () => mockRequireStudioApi(),
}))

jest.mock('@/lib/admin-api-auth', () => ({
  requireAdminApi: () => mockRequireAdminApi(),
}))

jest.mock('@/lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

jest.mock('../../retry', () => {
  const actual = jest.requireActual('../../retry')
  return {
    ...actual,
    fetchJsonWithRetry: (...args: unknown[]) => mockFetchJsonWithRetry(...args),
  }
})

jest.mock('@/lib/supabase-server', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: MockStyleTable) => mockTable(table),
  }),
}))

import { GET as getCustomerStyles } from '@/app/api/studio/styles/route'
import {
  DELETE as deleteBackground,
  PATCH as patchBackground,
} from '@/app/api/admin/studio-styles/background/[id]/route'
import {
  GET as getBackgroundStyles,
  POST as createBackground,
} from '@/app/api/admin/studio-styles/background/route'
import {
  DELETE as deleteLighting,
  PATCH as patchLighting,
} from '@/app/api/admin/studio-styles/lighting/[id]/route'
import {
  GET as getLightingStyles,
  POST as createLighting,
} from '@/app/api/admin/studio-styles/lighting/route'
import { logger } from '@/lib/logger'
import { NanoBananaClient } from '@/lib/nano-banana'
import { generateDirective } from '@/lib/photo-control/directive-generator'
import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import { applyDelta, computeDelta } from '@/lib/photo-control/state-delta'
import {
  buildStyleDirectiveClause,
  resolveBackgroundStyle,
  resolveLightingStyle,
} from '@/lib/studio/reference-libraries'

const mockLogger = logger as jest.Mocked<typeof logger>

const SEEDED_LIGHTING_KEYS = ['bright-and-airy', 'low-key', 'studio', 'golden-hour']
const SEEDED_BACKGROUND_KEYS = [
  'dark-slate',
  'rustic-wood',
  'granite-light',
  'marble-light',
  'white-tablecloth',
  'studio-nightsky',
  'studio-red',
  'studio-grey-white',
  'studio-yellow',
]

function mockStyleRow(
  key: string,
  overrides: Partial<MockStyleRow> = {},
): MockStyleRow {
  return {
    id: `seed-${key}`,
    key,
    name: `Style ${key}`,
    short_description: `Short description for ${key}`,
    category: 'surface',
    thumbnail_path: `styles/${key}`,
    is_premium: false,
    sort_order: 0,
    prompt_fragment: `Apply ${key} while preserving the dish.`,
    negative_constraints: 'Do not add props.',
    descriptor: { private: 'future server-only descriptor' },
    is_active: true,
    created_at: '2026-07-28T00:00:00.000Z',
    updated_at: '2026-07-28T00:00:00.000Z',
    ...overrides,
  }
}

function mockResetStore(): void {
  mockNextId = 1
  mockRows = {
    studio_lighting_styles: SEEDED_LIGHTING_KEYS.map((key, index) =>
      mockStyleRow(key, { category: undefined, sort_order: index + 1 }),
    ),
    studio_background_styles: SEEDED_BACKGROUND_KEYS.map((key, index) =>
      mockStyleRow(key, {
        category: key.startsWith('studio-') ? 'backdrop' : 'surface',
        sort_order: index + 1,
      }),
    ),
  }
}

function mockProject(row: MockStyleRow, columns: string): MockStyleRow {
  return columns.split(',').reduce<MockStyleRow>((projected, column) => {
    const key = column.trim()
    if (key in row) projected[key] = row[key]
    return projected
  }, {})
}

function mockMatchingRows(table: MockStyleTable, filters: Array<[string, unknown]>): MockStyleRow[] {
  return mockRows[table]
    .filter((row) => filters.every(([field, value]) => row[field] === value))
    .map((row) => ({ ...row }))
}

function mockTable(table: MockStyleTable) {
  return {
    select(columns: string) {
      return mockSelect(table, columns, [])
    },
    insert(payload: MockStyleRow) {
      const row = {
        id: `${table}-created-${mockNextId++}`,
        is_active: true,
        is_premium: false,
        sort_order: 0,
        created_at: '2026-07-28T00:00:00.000Z',
        updated_at: '2026-07-28T00:00:00.000Z',
        ...payload,
      }
      mockRows[table].push(row)
      return {
        select(columns: string) {
          return { single: async () => ({ data: mockProject(row, columns), error: null }) }
        },
      }
    },
    update(updates: MockStyleRow) {
      return {
        eq(field: string, value: unknown) {
          return {
            select(columns: string) {
              return {
                single: async () => {
                  const row = mockRows[table].find((candidate) => candidate[field] === value)
                  if (!row) return { data: null, error: { message: 'Not found' } }
                  Object.assign(row, updates, { updated_at: '2026-07-28T00:00:00.000Z' })
                  return { data: mockProject(row, columns), error: null }
                },
              }
            },
          }
        },
      }
    },
    delete() {
      return {
        eq: async (field: string, value: unknown) => {
          mockRows[table] = mockRows[table].filter((row) => row[field] !== value)
          return { error: null }
        },
      }
    },
  }
}

function mockSelect(
  table: MockStyleTable,
  columns: string,
  filters: Array<[string, unknown]>,
): {
  eq: (field: string, value: unknown) => ReturnType<typeof mockSelect>
  order: (field: string, options?: { ascending?: boolean }) => Promise<{ data: MockStyleRow[]; error: null }>
  maybeSingle: () => Promise<{ data: MockStyleRow | null; error: null }>
} {
  return {
    eq(field, value) {
      return mockSelect(table, columns, [...filters, [field, value]])
    },
    async order(field, options) {
      const direction = options?.ascending === false ? -1 : 1
      const data = mockMatchingRows(table, filters)
        .sort((left, right) => {
          const a = left[field]
          const b = right[field]
          return (a === b ? 0 : a! > b! ? 1 : -1) * direction
        })
        .map((row) => mockProject(row, columns))
      return { data, error: null }
    },
    async maybeSingle() {
      const row = mockMatchingRows(table, filters)[0] ?? null
      return { data: row ? mockProject(row, columns) : null, error: null }
    },
  }
}

function mockEditorState(background: string, overrides: Partial<EditorState['schema']['canvas']> = {}): EditorState {
  return {
    schema: {
      scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'bright-and-airy', spin: '0' },
      canvas: {
        background,
        background_style: '',
        surface_style: '',
        main_vessel: 'plate',
        ...overrides,
      },
      food_components: { main_item: 'rice bowl', garnishes: [], sides: [] },
    },
    position: { ...CENTER },
  }
}

const mockTextArbitrary = fc
  .array(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz0123456789 '.split('')), {
    minLength: 8,
    maxLength: 40,
  })
  .map((characters) => characters.join(''))

const mockStyleRowsArbitrary = fc.record({
  name: mockTextArbitrary,
  description: fc.option(mockTextArbitrary, { nil: null }),
  prompt: mockTextArbitrary,
  negative: mockTextArbitrary,
  category: fc.constantFrom<'surface' | 'environment' | 'backdrop'>(
    'surface',
    'environment',
    'backdrop',
  ),
  premium: fc.boolean(),
  sortOrder: fc.integer({ min: 0, max: 99 }),
})

beforeEach(() => {
  jest.clearAllMocks()
  mockResetStore()
  mockRequireStudioApi.mockResolvedValue({ ok: true, user: { id: 'customer-1' }, supabase: {} })
  mockRequireAdminApi.mockResolvedValue({ ok: true, user: { id: 'admin-1' }, supabase: {} })
  mockFetchJsonWithRetry.mockResolvedValue({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ inlineData: { data: 'generated-image' } }] } }],
    metadata: { model_version: 'unit-test', processing_time_ms: 1 },
  })
})

describe('Property 12: style library and logging preservation', () => {
  /** Validates: Requirements 3.9 */
  it('returns arbitrary style rows through /api/studio/styles with display fields only', async () => {
    await fc.assert(
      fc.asyncProperty(mockStyleRowsArbitrary, mockStyleRowsArbitrary, async (lighting, background) => {
        mockRows.studio_lighting_styles = [
          mockStyleRow('arbitrary-lighting', {
            name: lighting.name,
            short_description: lighting.description,
            prompt_fragment: lighting.prompt,
            negative_constraints: lighting.negative,
            descriptor: { private: lighting.prompt },
            sort_order: lighting.sortOrder,
          }),
        ]
        mockRows.studio_background_styles = [
          mockStyleRow('arbitrary-background', {
            name: background.name,
            short_description: background.description,
            category: background.category,
            is_premium: background.premium,
            prompt_fragment: background.prompt,
            negative_constraints: background.negative,
            descriptor: { private: background.prompt },
            sort_order: background.sortOrder,
          }),
        ]

        const response = await getCustomerStyles()
        expect(response.status).toBe(200)
        const payload = await response.json()

        expect(payload.lighting).toEqual([
          expect.objectContaining({
            key: 'arbitrary-lighting',
            name: lighting.name,
            short_description: lighting.description,
          }),
        ])
        expect(payload.background).toEqual([
          expect.objectContaining({
            key: 'arbitrary-background',
            name: background.name,
            short_description: background.description,
            category: background.category,
          }),
        ])
        for (const style of [...payload.lighting, ...payload.background]) {
          expect(style).not.toHaveProperty('prompt_fragment')
          expect(style).not.toHaveProperty('negative_constraints')
          expect(style).not.toHaveProperty('descriptor')
        }
      }),
      { numRuns: 25 },
    )
  })

  /** Validates: Requirements 3.10, 3.11 */
  it('resolves all thirteen seeded keys and preserves admin lighting/background CRUD round trips', async () => {
    const resolvedLighting = await Promise.all(SEEDED_LIGHTING_KEYS.map(resolveLightingStyle))
    const resolvedBackground = await Promise.all(SEEDED_BACKGROUND_KEYS.map(resolveBackgroundStyle))

    expect(resolvedLighting.map((style) => style?.key)).toEqual(SEEDED_LIGHTING_KEYS)
    expect(resolvedBackground.map((style) => style?.key)).toEqual(SEEDED_BACKGROUND_KEYS)
    expect([...resolvedLighting, ...resolvedBackground]).toHaveLength(13)
    expect([...resolvedLighting, ...resolvedBackground].every((style) => style?.prompt_fragment)).toBe(true)

    const lightingCreate = await createLighting(
      new NextRequest('http://localhost/api/admin/studio-styles/lighting', {
        method: 'POST',
        body: JSON.stringify({
          key: 'temporary-lighting',
          name: 'Temporary lighting',
          shortDescription: 'A temporary lighting style',
          promptFragment: 'Apply temporary lighting.',
        }),
      }),
    )
    const lighting = (await lightingCreate.json()).style
    expect(lightingCreate.status).toBe(201)

    const lightingPatch = await patchLighting(
      new NextRequest('http://localhost/api/admin/studio-styles/lighting/temporary', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated temporary lighting', promptFragment: 'Apply updated lighting.' }),
      }),
      { params: { id: lighting.id } },
    )
    expect((await lightingPatch.json()).style).toEqual(
      expect.objectContaining({ name: 'Updated temporary lighting', prompt_fragment: 'Apply updated lighting.' }),
    )
    expect((await getLightingStyles()).status).toBe(200)
    expect((await deleteLighting(new NextRequest('http://localhost'), { params: { id: lighting.id } })).status).toBe(200)

    const backgroundCreate = await createBackground(
      new NextRequest('http://localhost/api/admin/studio-styles/background', {
        method: 'POST',
        body: JSON.stringify({
          key: 'temporary-backdrop',
          name: 'Temporary backdrop',
          category: 'backdrop',
          shortDescription: 'A temporary backdrop style',
          promptFragment: 'Replace the backdrop temporarily.',
        }),
      }),
    )
    const background = (await backgroundCreate.json()).style
    expect(backgroundCreate.status).toBe(201)

    const backgroundPatch = await patchBackground(
      new NextRequest('http://localhost/api/admin/studio-styles/background/temporary', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated temporary backdrop', category: 'backdrop' }),
      }),
      { params: { id: background.id } },
    )
    expect((await backgroundPatch.json()).style).toEqual(
      expect.objectContaining({ name: 'Updated temporary backdrop', category: 'backdrop' }),
    )
    expect((await getBackgroundStyles()).status).toBe(200)
    expect((await deleteBackground(new NextRequest('http://localhost'), { params: { id: background.id } })).status).toBe(200)
  })

  /** Validates: Requirements 3.10 */
  it('keeps a null-descriptor row usable through its prompt fragment and short description', async () => {
    mockRows.studio_lighting_styles = [
      mockStyleRow('null-descriptor', {
        descriptor: null,
        short_description: 'Soft directional window light',
        prompt_fragment: 'Apply soft directional window light while preserving the dish.',
      }),
    ]

    const style = await resolveLightingStyle('null-descriptor')
    expect(style).toEqual(expect.objectContaining({ short_description: 'Soft directional window light' }))
    const payload = buildStyleDirectiveClause(style!.prompt_fragment, style!.negative_constraints)
    expect(payload.trim()).not.toHaveLength(0)
    expect(payload).toContain(style!.prompt_fragment)
  })


  /** Validates: Requirements 3.16 */
  it('keeps arbitrary extracted backgrounds untouched and non-editable without staged surface or backdrop changes', () => {
    fc.assert(
      fc.property(mockTextArbitrary, (background) => {
        const original = mockEditorState(`extracted background: ${background}`)
        const target = mockEditorState(`attempted replacement: ${background}`)
        target.schema.scene_setup.lighting = 'low-key'

        const delta = computeDelta(original, target)
        const applied = applyDelta(original, delta)
        const directive = generateDirective(delta, original)

        expect(delta.scalarChanges.map((change) => change.path)).not.toContain('canvas.background')
        expect(delta.scalarChanges.map((change) => change.path)).not.toContain('canvas.background_style')
        expect(delta.scalarChanges.map((change) => change.path)).not.toContain('canvas.surface_style')
        expect(applied.schema.canvas.background).toBe(original.schema.canvas.background)
        expect(applied.schema.canvas.background_style).toBe('')
        expect(applied.schema.canvas.surface_style).toBe('')
        expect(directive).not.toContain(original.schema.canvas.background)
        expect(directive).not.toContain(target.schema.canvas.background)
      }),
      { numRuns: 25 },
    )
  })

  /** Validates: Requirements 3.17 */
  it('keeps a visible backdrop selectable and emits the existing replace-the-backdrop directive', () => {
    const original = mockEditorState('Visible vertical restaurant wall behind the tabletop.')
    const target = mockEditorState('Visible vertical restaurant wall behind the tabletop.', {
      background_style: 'studio-yellow',
    })

    const directive = generateDirective(computeDelta(original, target), original)

    expect(directive).toContain('Change only the background backdrop')
    expect(directive).toContain('studio-yellow')
    expect(directive).toContain('Keep the tabletop surface')
  })

  /** Validates: Requirements 3.18 */
  it('logs arbitrary reference payloads only as mimeType and byte-count metadata', async () => {
    const base64LogThreshold = 16
    const referencePayloads = fc
      .array(fc.uint8Array({ minLength: 24, maxLength: 96 }), { minLength: 1, maxLength: 5 })
      .map((payloads) =>
        payloads.map((bytes, index) => ({
          mimeType: index % 2 === 0 ? ('image/png' as const) : ('image/jpeg' as const),
          data: Buffer.from(bytes).toString('base64'),
          role: index === 0 ? 'dish' : 'style',
        })),
      )

    await fc.assert(
      fc.asyncProperty(referencePayloads, async (referenceImages) => {
        mockLogger.info.mockClear()
        const client = new NanoBananaClient('preservation-test-key')

        await client.generateImage({
          prompt: 'Preserve the source dish.',
          model: 'gemini-3.1-flash-image-preview',
          reference_images: referenceImages,
        })

        const allLogContent = JSON.stringify(mockLogger.info.mock.calls)
        for (const reference of referenceImages) {
          expect(allLogContent).not.toContain(reference.data.slice(0, base64LogThreshold + 1))
        }

        const outboundLog = mockLogger.info.mock.calls.find(
          ([message]) => message === '🎨 [Nano Banana] Outbound request',
        )
        expect(outboundLog?.[1]).toEqual(
          expect.objectContaining({
            referenceImages: referenceImages.map((reference) => ({
              mimeType: reference.mimeType,
              bytes: Buffer.from(reference.data, 'base64').length,
            })),
          }),
        )
      }),
      { numRuns: 25 },
    )
  })
})

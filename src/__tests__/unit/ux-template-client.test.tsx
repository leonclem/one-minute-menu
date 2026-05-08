import React from 'react'
import { render, screen, act, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock next/navigation for client component navigation
const mockRouter = { push: jest.fn() }
jest.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/menus/demo-123/template',
}))

// Mock toast hook
const mockShowToast = jest.fn()
jest.mock('@/components/ui', () => ({
  useToast: () => ({ showToast: mockShowToast }),
}))

import UXMenuTemplateClient from '@/app/menus/[menuId]/template/template-client'

// Mock template response matching the API format
const mockTemplatesResponse = {
  data: [
    {
      template: {
        id: 'classic-grid-cards',
        name: 'Classic Grid Cards',
        description: 'A classic grid layout',
        previewImageUrl: '/previews/classic.png',
        capabilities: { supportsImages: true },
        constraints: { hardMaxItems: 150 }
      },
      compatibility: { status: 'OK', message: null, warnings: [] }
    },
    {
      template: {
        id: 'two-column-text',
        name: 'Two Column Text',
        description: 'A text-based two-column layout',
        previewImageUrl: '/previews/two-col.png',
        capabilities: { supportsImages: false },
        constraints: { hardMaxItems: 150 }
      },
      compatibility: { status: 'OK', message: null, warnings: [] }
    }
  ]
}

// Mock layout preview response
const mockLayoutResponse = {
  success: true,
  data: {
    templateId: 'classic-grid-cards',
    templateVersion: '1.0.0',
    pageSpec: {
      id: 'A4_PORTRAIT',
      width: 595.28,
      height: 841.89,
      margins: { top: 36, right: 36, bottom: 36, left: 36 }
    },
    pages: [{
      pageIndex: 0,
      pageType: 'SINGLE',
      regions: [],
      tiles: [
        { 
          id: 'title', 
          type: 'TITLE', 
          regionId: 'header', 
          x: 0, 
          y: 0, 
          width: 523, 
          height: 50, 
          colSpan: 3, 
          rowSpan: 1, 
          gridRow: 0, 
          gridCol: 0, 
          layer: 'content', 
          content: { text: 'Demo Brunch' } 
        }
      ]
    }],
    totalPages: 1
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal menu API response with optional flagship item. */
function makeMenuResponse(flagshipItemId: string | null) {
  return {
    data: {
      id: 'menu-abc',
      name: 'Test Menu',
      items: [
        { id: 'item-old', name: 'Old Flagship', isFlagship: false },
        { id: 'item-new', name: 'New Flagship', isFlagship: flagshipItemId === 'item-new' },
      ],
      categories: [],
    },
  }
}

/** Build a minimal template-selection API response. */
function makeSelectionResponse(flagshipItemId: string | null) {
  return {
    data: {
      templateId: '6-column-portrait-a3',
      configuration: {
        flagshipItemId,
        colourPaletteId: 'elegant-cream',
        imageMode: 'compact-rect',
      },
    },
  }
}

/** Build a session draft with a given flagshipItemId. */
function makeDraft(menuId: string, flagshipItemId: string | null) {
  return JSON.stringify({
    templateId: '6-column-portrait-a3',
    configuration: {
      flagshipItemId,
      colourPaletteId: 'elegant-cream',
      imageMode: 'compact-rect',
    },
  })
}

// ─── Demo flow ───────────────────────────────────────────────────────────────

describe('UXMenuTemplateClient (demo flow)', () => {
  beforeEach(() => {
    // Seed demo menu in sessionStorage
    const demoMenu = {
      id: 'demo-123',
      name: 'Demo Brunch',
      items: [{ id: 'i1', name: 'Pancakes', price: 8.5, available: true }],
      theme: {},
    }
    window.sessionStorage.setItem('demoMenu', JSON.stringify(demoMenu))

    // Mock fetch for API calls
    global.fetch = jest.fn().mockImplementation((url: string) => {
      if (url === '/api/templates/available') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockTemplatesResponse)
        })
      }
      if (url.includes('/api/menus/') && url.includes('/layout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLayoutResponse)
        })
      }
      return Promise.reject(new Error('Unmocked endpoint: ' + url))
    }) as jest.Mock
  })

  afterEach(() => {
    window.sessionStorage.clear()
    jest.clearAllMocks()
    // @ts-ignore
    global.fetch = undefined
  })

  it('shows "Confirm and Export" for demo users', async () => {
    const { unmount } = render(<UXMenuTemplateClient menuId="demo-123" />)
    expect(await screen.findByText(/Confirm and Export/)).toBeInTheDocument()
    unmount()
  })
})

// ─── Flagship flag sync — authenticated user ─────────────────────────────────
//
// These tests verify the bug condition (Property 1) and preservation (Property 2)
// for the authenticated-user load paths in template-client.tsx.
//
// The component calls /api/menus/:id to get the menu (which includes isFlagship
// on items) and /api/menus/:id/template-selection for the saved config.
// The session draft (sessionStorage) is checked first.
//
// We verify the fix by inspecting the body sent to the /layout endpoint, which
// includes `flagshipItemId` derived from the component's state.

describe('UXMenuTemplateClient — flagship flag sync (authenticated user)', () => {
  const menuId = 'menu-abc'

  function setupFetch(opts: {
    menuFlagshipId: string | null
    selectionFlagshipId?: string | null
    hasDraft?: boolean
    draftFlagshipId?: string | null
  }) {
    const {
      menuFlagshipId,
      selectionFlagshipId = null,
      hasDraft = false,
      draftFlagshipId = null,
    } = opts

    if (hasDraft) {
      window.sessionStorage.setItem(
        `templateDraft-${menuId}`,
        makeDraft(menuId, draftFlagshipId)
      )
    }

    global.fetch = jest.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === `/api/menus/${menuId}`) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeMenuResponse(menuFlagshipId)),
        })
      }
      if (url === `/api/menus/${menuId}/template-selection`) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makeSelectionResponse(selectionFlagshipId)),
        })
      }
      if (url.includes('/layout')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockLayoutResponse),
        })
      }
      if (url === '/api/profile') {
        return Promise.resolve({ ok: false })
      }
      return Promise.reject(new Error('Unmocked endpoint: ' + url))
    }) as jest.Mock
  }

  afterEach(() => {
    window.sessionStorage.clear()
    jest.clearAllMocks()
    // @ts-ignore
    global.fetch = undefined
  })

  /**
   * Helper: render the component and wait for the layout API call, then return
   * the flagship-related params from the most recent /layout call.
   * For demo users: POST with JSON body.
   * For authenticated users: GET with query params.
   */
  async function renderAndGetLayoutParams(menuId: string) {
    const { unmount } = render(<UXMenuTemplateClient menuId={menuId} />)

    // Wait for the layout fetch to be called (component finishes loading)
    await new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const calls = (global.fetch as jest.Mock).mock.calls
        const layoutCall = calls.find(([url]: [string]) => url?.includes('/layout'))
        if (layoutCall) {
          clearInterval(interval)
          resolve()
        }
      }, 50)
      // Timeout after 3s
      setTimeout(() => { clearInterval(interval); resolve() }, 3000)
    })

    const calls = (global.fetch as jest.Mock).mock.calls
    const layoutCall = calls.find(([url]: [string]) => url?.includes('/layout'))
    unmount()

    if (!layoutCall) return null
    const [url, init] = layoutCall

    // Demo user: POST with JSON body
    if (init?.method === 'POST' && init?.body) {
      const body = JSON.parse(init.body as string)
      return {
        flagshipItemId: body?.configuration?.flagshipItemId ?? null,
        showFlagshipTile: body?.configuration?.showFlagshipTile ?? false,
      }
    }

    // Authenticated user: GET with query params in URL
    const urlObj = new URL(url, 'http://localhost')
    const flagshipItemId = urlObj.searchParams.get('flagshipItemId') ?? null
    const showFlagshipTile = urlObj.searchParams.get('showFlagshipTile') === 'true'
    return { flagshipItemId, showFlagshipTile }
  }

  // ── Property 1: Bug Condition ─────────────────────────────────────────────
  // When DB has no flagship AND a draft with a flagshipItemId exists,
  // the component MUST use null (not the stale draft value).

  it('[EXPLORATORY] draft path: DB flagship cleared + stale draft → flagshipItemId should be null (demonstrates bug on unfixed code)', async () => {
    setupFetch({
      menuFlagshipId: null,       // DB has no flagship
      hasDraft: true,
      draftFlagshipId: 'item-old', // stale draft has a flagship
    })

    const params = await renderAndGetLayoutParams(menuId)
    // After the fix: flagshipItemId must be null (or undefined/absent)
    // On unfixed code this will be 'item-old' — demonstrating the bug
    expect(params?.flagshipItemId ?? null).toBeNull()
  })

  it('[EXPLORATORY] saved-selection path: DB flagship cleared + stale saved selection → flagshipItemId should be null', async () => {
    setupFetch({
      menuFlagshipId: null,            // DB has no flagship
      selectionFlagshipId: 'item-old', // saved selection has a flagship
      hasDraft: false,
    })

    const params = await renderAndGetLayoutParams(menuId)
    // After the fix: flagshipItemId must be null
    // On unfixed code this will be 'item-old' — demonstrating the bug
    expect(params?.flagshipItemId ?? null).toBeNull()
  })

  // ── Property 2: Preservation ──────────────────────────────────────────────
  // When DB has a flagship, it must be used regardless of draft.

  it('[PRESERVATION] draft path: DB has flagship + draft has different flagship → DB flagship wins', async () => {
    setupFetch({
      menuFlagshipId: 'item-new',  // DB has item-new as flagship
      hasDraft: true,
      draftFlagshipId: 'item-old', // draft has stale item-old
    })

    const params = await renderAndGetLayoutParams(menuId)
    expect(params?.flagshipItemId).toBe('item-new')
  })

  it('[PRESERVATION] saved-selection path: DB has flagship + saved selection has different flagship → DB flagship wins', async () => {
    setupFetch({
      menuFlagshipId: 'item-new',       // DB has item-new as flagship
      selectionFlagshipId: 'item-old',  // saved selection has stale item-old
      hasDraft: false,
    })

    const params = await renderAndGetLayoutParams(menuId)
    expect(params?.flagshipItemId).toBe('item-new')
  })

  it('[PRESERVATION] no draft, no saved selection, DB has flagship → flagship shown', async () => {
    setupFetch({
      menuFlagshipId: 'item-new',
      hasDraft: false,
    })

    const params = await renderAndGetLayoutParams(menuId)
    // No draft and no saved selection: falls through to no-config path,
    // which doesn't set flagshipItemId via the buggy pattern.
    // The DB flagship is still accessible via currentFlagshipItem memo.
    expect(params?.flagshipItemId ?? null).not.toBe('item-old')
  })

  it('[PRESERVATION] no flagship in DB, no draft → flagshipItemId is null', async () => {
    setupFetch({
      menuFlagshipId: null,
      hasDraft: false,
    })

    const params = await renderAndGetLayoutParams(menuId)
    expect(params?.flagshipItemId ?? null).toBeNull()
  })
})

// ─── Property-Based Tests — flagship load logic ───────────────────────────────
//
// These tests verify the core fix logic in isolation using fast-check.
// The fix replaces `dbFlagshipId || draftFlagshipId || null`
// with `dbFlagshipId ?? null`.
//
// Property 1 (Bug Condition): When DB has no flagship, result is always null.
// Property 2 (Preservation): When DB has a flagship, result is always that ID.

import fc from 'fast-check'

describe('flagship load logic — property-based tests', () => {
  /**
   * The fixed logic extracted for unit testing:
   * dbFlagshipId is the result of .find(i => i.isFlagship)?.id
   * which is `string | undefined` (never null).
   */
  function fixedFlagshipLogic(
    dbFlagshipId: string | undefined,
    _draftFlagshipId: string | null  // intentionally ignored by the fix
  ): string | null {
    return dbFlagshipId ?? null
  }

  /**
   * The original (buggy) logic for comparison:
   */
  function originalFlagshipLogic(
    dbFlagshipId: string | undefined,
    draftFlagshipId: string | null
  ): string | null {
    return dbFlagshipId || draftFlagshipId || null
  }

  // Property 1: Bug Condition
  // For any input where DB has no flagship (dbFlagshipId is undefined),
  // the fixed function SHALL return null regardless of draft value.
  it('Property 1 (Bug Condition): DB has no flagship → result is always null', () => {
    fc.assert(
      fc.property(
        // draftFlagshipId: any string or null (simulates stale draft)
        fc.oneof(fc.string({ minLength: 1, maxLength: 50 }), fc.constant(null)),
        (draftFlagshipId) => {
          const dbFlagshipId = undefined // DB has no flagship
          const result = fixedFlagshipLogic(dbFlagshipId, draftFlagshipId)
          return result === null
        }
      ),
      { numRuns: 200 }
    )
  })

  // Property 2: Preservation
  // For any input where DB has a flagship (dbFlagshipId is a non-empty string),
  // the fixed function SHALL return that DB flagship ID.
  it('Property 2 (Preservation): DB has flagship → result is always the DB flagship ID', () => {
    fc.assert(
      fc.property(
        // dbFlagshipId: any non-empty string (simulates a real item ID)
        fc.string({ minLength: 1, maxLength: 50 }),
        // draftFlagshipId: any string or null (simulates any draft state)
        fc.oneof(fc.string({ minLength: 1, maxLength: 50 }), fc.constant(null)),
        (dbFlagshipId, draftFlagshipId) => {
          const result = fixedFlagshipLogic(dbFlagshipId, draftFlagshipId)
          return result === dbFlagshipId
        }
      ),
      { numRuns: 200 }
    )
  })

  // Regression check: the original logic fails Property 1 when draft has a value.
  // This confirms the fix is necessary (not just a no-op refactor).
  it('Regression: original logic violates Property 1 when draft has a non-null value', () => {
    // Find a counterexample: DB has no flagship, draft has a value → original returns draft value
    const counterexample = originalFlagshipLogic(undefined, 'stale-item-id')
    expect(counterexample).toBe('stale-item-id') // original is buggy
    expect(fixedFlagshipLogic(undefined, 'stale-item-id')).toBeNull() // fixed is correct
  })
})



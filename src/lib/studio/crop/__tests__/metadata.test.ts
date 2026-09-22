import { buildCropChildMetadata, parseCropAspectPreset } from '../metadata'

describe('buildCropChildMetadata', () => {
  it('copies editor JSON and drops spatial / object-edit keys', () => {
    const next = buildCropChildMetadata({
      parentMetadata: {
        editorState: { schema: { food_components: { main_item: 'curry' } } },
        extractionDiagnostics: { version: 1 },
        finishingTouches: { stackIds: ['coriander'], level: 1, auto: true },
        objectEdit: { operation: 'remove' },
        spatialInventoryDiagnostics: { version: 1, status: 'ok' },
        validation: { status: 'pass' },
        changeSummary: ['Lighting'],
      },
      crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.5 },
      aspectPreset: '1:1',
    })

    expect(next.mode).toBe('crop')
    expect(next.crop).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.5, aspectPreset: '1:1' })
    expect(next.editorState).toEqual({ schema: { food_components: { main_item: 'curry' } } })
    expect(next.extractionDiagnostics).toEqual({ version: 1 })
    expect(next.finishingTouches).toEqual({ stackIds: ['coriander'], level: 1, auto: true })
    expect(next).not.toHaveProperty('objectEdit')
    expect(next).not.toHaveProperty('spatialInventoryDiagnostics')
    expect(next).not.toHaveProperty('validation')
  })

  it('copies skip-extract flags so guest crops stay unextracted', () => {
    const next = buildCropChildMetadata({
      parentMetadata: {
        editorState: { schema: {} },
        skipExtractUntilClaimed: true,
        guestStagedIntent: { lighting: 'golden-hour', background_style: '', surface_style: '' },
      },
      crop: { x: 0, y: 0, width: 1, height: 1 },
      aspectPreset: 'free',
    })
    expect((next as Record<string, unknown>).skipExtractUntilClaimed).toBe(true)
    expect((next as Record<string, unknown>).guestStagedIntent).toEqual({
      lighting: 'golden-hour',
      background_style: '',
      surface_style: '',
    })
  })
})

describe('parseCropAspectPreset', () => {
  it('falls back to free for unknown values', () => {
    expect(parseCropAspectPreset('4:5')).toBe('4:5')
    expect(parseCropAspectPreset('nope')).toBe('free')
  })
})

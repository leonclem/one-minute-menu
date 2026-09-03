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
})

describe('parseCropAspectPreset', () => {
  it('falls back to free for unknown values', () => {
    expect(parseCropAspectPreset('4:5')).toBe('4:5')
    expect(parseCropAspectPreset('nope')).toBe('free')
  })
})

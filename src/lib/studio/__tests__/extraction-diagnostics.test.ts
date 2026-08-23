import {
  buildExtractionDiagnostics,
  EXTRACTION_DIAGNOSTICS_MAX_BYTES,
  EXTRACTION_DIAGNOSTICS_VERSION,
  extractionDiagnosticsNeedsRefresh,
  OBSERVED_PATH_LIMITS,
  sanitizeExtractionDiagnostics,
} from '../extraction-diagnostics'
import { validateMinimalSchema } from '@/lib/photo-control/schema-validator'

/** Spaced prose so `safeText` does not treat the string as an echoed data URL. */
function longProse(length: number): string {
  const unit = 'plated chicken rice with cucumber and chilli. '
  return unit.repeat(Math.ceil(length / unit.length)).slice(0, length)
}

describe('buildExtractionDiagnostics', () => {
  it('classifies absent, invalid, and control-state coercion omissions', () => {
    const raw = {
      scene_setup: { angle: 'not-an-angle', framing: 'wide', lighting: 'studio' },
      canvas: { background: 'slate' },
      backdrop: { colour: 'not-hex' },
      food_components: { main_item: 'rice', garnishes: [], sides: [] },
    }
    const validated = validateMinimalSchema(raw)
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings: validated.warnings,
      strictConformance: validated.strictConformance,
    })

    expect(diagnostics.omittedFields).toEqual(expect.arrayContaining([
      { path: 'scene_setup.angle', reason: 'coerced_for_control_state' },
      { path: 'scene_setup.spin', reason: 'coerced_for_control_state' },
      { path: 'backdrop.colour', reason: 'invalid' },
      { path: 'backdrop.material', reason: 'absent' },
    ]))
  })

  it('records validator warnings and remains bounded', () => {
    const raw = {
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'golden-hour', spin: '0' },
      canvas: { background: 'table', main_vessel: 'plate' },
      food_components: { main_item: 'dish', garnishes: [], sides: [] },
      description: 'A '.repeat(5000),
    }
    const validated = validateMinimalSchema(raw)
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings: validated.warnings,
      strictConformance: validated.strictConformance,
    })

    expect(diagnostics.warnings).toEqual(expect.any(Array))
    expect(JSON.stringify(diagnostics).length).toBeLessThanOrEqual(EXTRACTION_DIAGNOSTICS_MAX_BYTES)
  })

  it('never copies image bytes into the persisted block', () => {
    const imageBytes = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQ'
    const raw = {
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: { background: imageBytes, main_vessel: 'plate' },
      food_components: { main_item: 'dish', garnishes: [], sides: [] },
      description: imageBytes,
    }
    const validated = validateMinimalSchema(raw)
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings: validated.warnings,
      strictConformance: validated.strictConformance,
    })

    expect(JSON.stringify(diagnostics)).not.toContain(imageBytes)
  })

  it('applies per-path limits at build time', () => {
    const longDescription = longProse(OBSERVED_PATH_LIMITS.description + 200)
    const longMaterial = Array.from({ length: 200 }, (_, i) => `mat${i % 11}`).join(' ')
    const raw = {
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: { background: 'table', main_vessel: 'plate' },
      food_components: { main_item: 'dish', garnishes: [], sides: [] },
      description: longDescription,
      backdrop: { material: longMaterial },
    }
    const validated = validateMinimalSchema(raw)
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings: validated.warnings,
      strictConformance: validated.strictConformance,
    })

    expect(diagnostics.version).toBe(EXTRACTION_DIAGNOSTICS_VERSION)
    expect((diagnostics.observations as { description?: string }).description).toHaveLength(
      OBSERVED_PATH_LIMITS.description,
    )
    expect((diagnostics.observations as { backdrop?: { material?: string } }).backdrop?.material).toHaveLength(
      OBSERVED_PATH_LIMITS['backdrop.material'],
    )
  })

  it('applies the same per-path limits when sanitizing client-posted diagnostics', () => {
    const longDescription = longProse(OBSERVED_PATH_LIMITS.description + 200)
    const posted = {
      version: 1,
      strictConformance: true,
      warnings: [],
      omittedFields: [],
      observations: {
        description: longDescription,
        'scene_setup.lighting': 'studio',
      },
    }
    const sanitized = sanitizeExtractionDiagnostics(posted)
    expect(sanitized).not.toBeNull()
    expect((sanitized!.observations as { description?: string }).description).toHaveLength(
      OBSERVED_PATH_LIMITS.description,
    )
  })

  it('degrades pathological blocks progressively instead of emptying all observations', () => {
    const warnings = Array.from({ length: 16 }, (_, index) => ({
      path: `field.${index}`,
      message: 'W'.repeat(280),
      severity: 'medium' as const,
    }))
    const raw = {
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: { background: 'table', main_vessel: 'plate' },
      food_components: {
        main_item: 'dish',
        garnishes: Array.from({ length: 12 }, (_, i) => 'G'.repeat(80) + i),
        sides: Array.from({ length: 12 }, (_, i) => 'S'.repeat(80) + i),
      },
      description: 'A '.repeat(400),
      backdrop: { material: 'slate wall', colour: '#AABBCC' },
      surface: { material: 'wood table', colour: '#112233' },
    }
    const validated = validateMinimalSchema(raw)
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings,
      strictConformance: validated.strictConformance,
    })

    expect(Object.keys(diagnostics.observations).length).toBeGreaterThan(0)
    expect(JSON.stringify(diagnostics).length).toBeLessThanOrEqual(EXTRACTION_DIAGNOSTICS_MAX_BYTES)
  })

  it('keeps a full-length description without degrading a typical block', () => {
    const description = longProse(OBSERVED_PATH_LIMITS.description)
    const raw = {
      scene_setup: { angle: 'top-down', framing: 'medium', lighting: 'studio', spin: '0' },
      canvas: { background: 'table', main_vessel: 'plate' },
      food_components: { main_item: 'dish', garnishes: ['herb'], sides: [] },
      description,
    }
    const validated = validateMinimalSchema(raw)
    const diagnostics = buildExtractionDiagnostics({
      raw,
      validated,
      warnings: validated.warnings,
      strictConformance: validated.strictConformance,
    })

    expect((diagnostics.observations as { description?: string }).description).toBe(description)
    expect(JSON.stringify(diagnostics).length).toBeLessThanOrEqual(EXTRACTION_DIAGNOSTICS_MAX_BYTES)
  })

  it('treats prior diagnostics versions as stale so source images re-extract', () => {
    expect(extractionDiagnosticsNeedsRefresh(null)).toBe(true)
    expect(extractionDiagnosticsNeedsRefresh({
      version: 1,
      strictConformance: false,
      warnings: [],
      omittedFields: [],
      observations: {},
    })).toBe(true)
    expect(extractionDiagnosticsNeedsRefresh({
      version: 2,
      strictConformance: false,
      warnings: [],
      omittedFields: [],
      observations: {},
    })).toBe(true)
    expect(extractionDiagnosticsNeedsRefresh({
      version: EXTRACTION_DIAGNOSTICS_VERSION,
      strictConformance: false,
      warnings: [],
      omittedFields: [],
      observations: {},
    })).toBe(false)
  })
})

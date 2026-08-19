import {
  buildExtractionDiagnostics,
  EXTRACTION_DIAGNOSTICS_MAX_BYTES,
  EXTRACTION_DIAGNOSTICS_VERSION,
  OBSERVED_PATH_LIMITS,
  sanitizeExtractionDiagnostics,
} from '../extraction-diagnostics'
import { validateMinimalSchema } from '@/lib/photo-control/schema-validator'

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
    const longDescription = Array.from({ length: 900 }, (_, i) => `word${i % 17}`).join(' ')
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
    expect((diagnostics.observations as { backdrop?: { material?: string } }).backdrop?.material).toHaveLength(120)
  })

  it('applies the same per-path limits when sanitizing client-posted diagnostics', () => {
    const longDescription = Array.from({ length: 900 }, (_, i) => `word${i % 17}`).join(' ')
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
})

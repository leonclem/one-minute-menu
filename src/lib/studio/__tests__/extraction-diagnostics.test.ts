import {
  buildExtractionDiagnostics,
  EXTRACTION_DIAGNOSTICS_MAX_BYTES,
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
})

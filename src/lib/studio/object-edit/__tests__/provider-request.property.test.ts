import fc from 'fast-check'

import { buildGeminiRequest } from '@/lib/nano-banana'
import { deriveSelectionBoundingRegion, deriveSelectionSourcePoint, type AnnotationStroke, type StructuredEditIntent } from '../contracts'
import { buildObjectEditInstruction } from '../instruction'

const canonical = {
  scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft daylight', spin: '0' },
  canvas: { background: 'neutral', background_style: '', surface_style: '', main_vessel: 'plate' },
  food_components: { main_item: 'pasta', garnishes: ['basil'], sides: ['bread'] },
} as const
const pointArbitrary = fc.record({ x: fc.double({ min: 0, max: 1, noNaN: true }), y: fc.double({ min: 0, max: 1, noNaN: true }) })

function intentFor(operation: 'remove' | 'move', point: { x: number; y: number }, destination: { x: number; y: number }): StructuredEditIntent {
  const strokes: AnnotationStroke[] = [{ kind: 'tap', points: [point] }]
  const selection = { version: 1 as const, strokes, boundingRegion: deriveSelectionBoundingRegion(strokes) }
  return operation === 'move'
    ? { version: 1, operation, selection, placement: { source: deriveSelectionSourcePoint(selection.boundingRegion), destination } }
    : { version: 1, operation, selection }
}

describe('object-edit provider request properties', () => {
  it('Property 12: emits only supported Gemini fields and ordered instruction/Image A/Image B parts', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('remove' as const, 'move' as const),
        pointArbitrary,
        pointArbitrary,
        fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { minLength: 2, maxLength: 64 }).map((characters) => characters.join('')),
        fc.array(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f'), { minLength: 2, maxLength: 64 }).map((characters) => characters.join('')),
        (operation, point, destination, clean, annotated) => {
          const intent = intentFor(operation, point, destination)
          const built = buildObjectEditInstruction({ intent, canonical })
          const request = buildGeminiRequest({
            prompt: built.instruction,
            model: 'gemini-3.1-flash-image',
            number_of_images: 1,
            person_generation: 'dont_allow',
            safety_filter_level: 'block_some',
            image_size: '2K',
            request_scope: 'studio_object_edit',
            reference_images: [
              { mimeType: 'image/png', data: clean, role: 'dish' },
              { mimeType: 'image/png', data: annotated, role: 'other' },
            ],
          }, { apiKey: 'test-key' })
          const body = request.requestBody as { contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>; generationConfig: Record<string, unknown> }

          expect(Object.keys(body)).toEqual(['contents', 'generationConfig'])
          expect(body.contents).toHaveLength(1)
          expect(body.contents[0].role).toBe('user')
          expect(body.contents[0].parts).toEqual([
            { text: request.loggedPrompt },
            { inlineData: { mimeType: 'image/png', data: clean } },
            { inlineData: { mimeType: 'image/png', data: annotated } },
          ])
          expect(request.loggedPrompt).toContain(built.instruction)
          expect(request.loggedPrompt).not.toContain('Edit the provided')
          expect(request.loggedPrompt).toContain('Image A is the current clean source image to edit.')
          expect(request.loggedPrompt).toContain('Image B is guidance only and must not appear in the output.')
          expect(request.loggedPrompt).toContain(operation === 'move' ? 'Relocate only the one object' : 'Remove only the one object')
          expect(JSON.stringify(body)).not.toMatch(/"selection"\s*:/)
          expect(JSON.stringify(body)).not.toMatch(/"placement"\s*:/)
          expect(request.loggedPrompt).toContain('Structured object-edit contract:')
        },
      ),
      { numRuns: 100 },
    )
  })
})

/**
 * @jest-environment node
 */

import { buildDishExportMatrix, dishExportMatrixPending } from '../dish-export-matrix'
import type { StudioExportVariantRecord, StudioImageRecord } from '@/lib/studio/types'

function image(
  overrides: Partial<StudioImageRecord> & Pick<StudioImageRecord, 'id' | 'role'>,
): StudioImageRecord {
  return {
    dish_id: 'dish-1',
    user_id: 'u1',
    storage_path: `${overrides.id}.png`,
    public_url: `https://example.com/${overrides.id}.png`,
    mime_type: 'image/png',
    width: 1200,
    height: 1200,
    prompt: null,
    model: null,
    source_image_id: null,
    metadata: {},
    is_favourite: false,
    archived_at: null,
    created_at: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

function exportRow(
  overrides: Partial<StudioExportVariantRecord> &
    Pick<StudioExportVariantRecord, 'id' | 'source_image_id' | 'variant_type' | 'status'>,
): StudioExportVariantRecord {
  return {
    user_id: 'u1',
    dish_id: 'dish-1',
    parent_image_id: null,
    width: 1500,
    height: 1500,
    aspect_ratio: '1:1',
    file_type: 'jpg',
    storage_path: null,
    preview_url: overrides.status === 'ready' ? 'https://cdn.example/ready.jpg' : null,
    generation_method: 'crop_resize',
    estimated_credits: 0,
    credits_charged: 0,
    error_message: null,
    metadata: {},
    created_at: '2026-08-15T00:00:00.000Z',
    updated_at: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

describe('buildDishExportMatrix', () => {
  it('builds five tiles per shot and maps ready rows onto the matching image', () => {
    const og = image({ id: 'og', role: 'source' })
    const child = image({
      id: 'v1',
      role: 'generated',
      source_image_id: 'og',
      created_at: '2026-08-15T01:00:00.000Z',
    })
    const matrix = buildDishExportMatrix(
      [child, og],
      [
        exportRow({
          id: 'e1',
          source_image_id: 'og',
          variant_type: 'pdf_menu_tile',
          status: 'ready',
        }),
        exportRow({
          id: 'e2',
          source_image_id: 'v1',
          variant_type: 'delivery_square',
          status: 'generating',
        }),
      ],
    )

    expect(matrix.map((row) => row.imageId)).toEqual(['og', 'v1'])
    expect(matrix[0].tiles).toHaveLength(5)
    expect(matrix[0].tiles.find((tile) => tile.variantType === 'pdf_menu_tile')?.status).toBe(
      'ready',
    )
    expect(matrix[1].tiles.find((tile) => tile.variantType === 'delivery_square')?.status).toBe(
      'generating',
    )
    expect(dishExportMatrixPending(matrix)).toBe(true)
  })
})

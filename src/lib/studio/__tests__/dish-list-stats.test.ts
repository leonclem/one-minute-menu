/**
 * @jest-environment node
 */

import {
  attachStudioDishListStats,
  dishGridStatusText,
  type StudioDishListImageRow,
} from '../dish-list-stats'
import type { StudioDishRecord } from '@/lib/studio/types'

function imageRow(
  overrides: Partial<StudioDishListImageRow> & Pick<StudioDishListImageRow, 'id' | 'dish_id'>,
): StudioDishListImageRow {
  return {
    role: 'source',
    source_image_id: null,
    public_url: `https://cdn.example/${overrides.id}.png`,
    created_at: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

const burger: StudioDishRecord = {
  id: 'd1',
  user_id: 'u1',
  name: 'Chicken Burger',
  description: null,
  current_image_id: 'img-2',
  generation_failure_count: 0,
  generation_blocked_at: null,
  generation_blocked_reason: null,
  created_at: '2026-08-01T00:00:00.000Z',
  updated_at: '2026-08-02T00:00:00.000Z',
}

const risotto: StudioDishRecord = {
  ...burger,
  id: 'd2',
  name: 'Mushroom Risotto',
  current_image_id: null,
}

describe('attachStudioDishListStats', () => {
  it('counts shots and ready exports per dish and uses the newest image as the thumb', () => {
    const [listedBurger, listedRisotto] = attachStudioDishListStats(
      [burger, risotto],
      [
        imageRow({
          id: 'img-1',
          dish_id: 'd1',
          role: 'generated',
          source_image_id: 'img-2',
          public_url: 'https://cdn.example/1.png',
          created_at: '2026-08-03T00:00:00.000Z',
        }),
        imageRow({
          id: 'img-2',
          dish_id: 'd1',
          public_url: 'https://cdn.example/2.png',
          created_at: '2026-08-02T12:00:00.000Z',
        }),
      ],
      [{ dish_id: 'd1' }, { dish_id: 'd1' }, { dish_id: 'd1' }],
    )

    expect(listedBurger.shotCount).toBe(2)
    expect(listedBurger.readyExportCount).toBe(3)
    expect(listedBurger.current_image_id).toBe('img-2')
    expect(listedBurger.current_image_url).toBe('https://cdn.example/1.png')
    expect(listedBurger.original_image_url).toBe('https://cdn.example/2.png')
    expect(listedRisotto.shotCount).toBe(0)
    expect(listedRisotto.original_image_url).toBeNull()
    expect(listedRisotto.readyExportCount).toBe(0)
    expect(listedRisotto.current_image_url).toBeNull()
  })

  it('orders dishes by the later of the dish edit time and the newest shot', () => {
    const olderDish: StudioDishRecord = {
      ...burger,
      id: 'd-old',
      name: 'Older edit',
      updated_at: '2026-08-01T00:00:00.000Z',
    }
    const renamedDish: StudioDishRecord = {
      ...burger,
      id: 'd-renamed',
      name: 'Renamed later',
      updated_at: '2026-08-05T00:00:00.000Z',
    }
    const freshShot: StudioDishRecord = {
      ...burger,
      id: 'd-shot',
      name: 'Fresh shot',
      updated_at: '2026-08-02T00:00:00.000Z',
    }

    const [first, second, third] = attachStudioDishListStats(
      [olderDish, renamedDish, freshShot],
      [
        imageRow({
          id: 'old-img',
          dish_id: 'd-old',
          public_url: 'https://cdn.example/old.png',
          created_at: '2026-08-01T00:00:00.000Z',
        }),
        imageRow({
          id: 'renamed-img',
          dish_id: 'd-renamed',
          public_url: 'https://cdn.example/renamed.png',
          created_at: '2026-08-02T00:00:00.000Z',
        }),
        imageRow({
          id: 'fresh-img',
          dish_id: 'd-shot',
          public_url: 'https://cdn.example/fresh.png',
          created_at: '2026-08-04T00:00:00.000Z',
        }),
      ],
      [],
    )

    expect(first.id).toBe('d-renamed')
    expect(second.id).toBe('d-shot')
    expect(second.current_image_url).toBe('https://cdn.example/fresh.png')
    expect(third.id).toBe('d-old')
    expect(second.original_image_url).toBeNull()
  })

  it('uses the upload behind the newest shot, including edits of a later upload', () => {
    const [listed] = attachStudioDishListStats(
      [burger],
      [
        imageRow({
          id: 'og',
          dish_id: 'd1',
          public_url: 'https://cdn.example/og.png',
          created_at: '2026-08-01T00:00:00.000Z',
        }),
        imageRow({
          id: 'og2',
          dish_id: 'd1',
          public_url: 'https://cdn.example/og2.png',
          created_at: '2026-08-02T00:00:00.000Z',
        }),
        imageRow({
          id: 'crop',
          dish_id: 'd1',
          role: 'generated',
          source_image_id: 'og2',
          public_url: 'https://cdn.example/crop.png',
          created_at: '2026-08-03T00:00:00.000Z',
        }),
        imageRow({
          id: 'v3',
          dish_id: 'd1',
          role: 'generated',
          source_image_id: 'crop',
          public_url: 'https://cdn.example/v3.png',
          created_at: '2026-08-04T00:00:00.000Z',
        }),
      ],
      [],
    )

    expect(listed.current_image_url).toBe('https://cdn.example/v3.png')
    expect(listed.original_image_url).toBe('https://cdn.example/og2.png')
  })

  it('omits the original when the newest shot is the upload or its upload is missing', () => {
    const uploadOnly: StudioDishRecord = { ...burger, id: 'd-upload', name: 'Upload only' }
    const orphan: StudioDishRecord = { ...burger, id: 'd-orphan', name: 'Missing parent' }
    const [uploaded, broken] = attachStudioDishListStats(
      [uploadOnly, orphan],
      [
        imageRow({
          id: 'only',
          dish_id: 'd-upload',
          public_url: 'https://cdn.example/only.png',
        }),
        imageRow({
          id: 'child',
          dish_id: 'd-orphan',
          role: 'generated',
          source_image_id: 'gone',
          public_url: 'https://cdn.example/child.png',
          created_at: '2026-08-03T00:00:00.000Z',
        }),
      ],
      [],
    )

    expect(uploaded.original_image_url).toBeNull()
    expect(broken.original_image_url).toBeNull()
  })
})

describe('dishGridStatusText', () => {
  it('uses No photo yet when there are no shots', () => {
    expect(dishGridStatusText({ shotCount: 0, readyExportCount: 0 })).toBe('No photo yet')
  })

  it('pluralises shots and ready files', () => {
    expect(dishGridStatusText({ shotCount: 1, readyExportCount: 0 })).toBe('1 shot · 0 files ready')
    expect(dishGridStatusText({ shotCount: 7, readyExportCount: 6 })).toBe('7 shots · 6 files ready')
    expect(dishGridStatusText({ shotCount: 2, readyExportCount: 1 })).toBe('2 shots · 1 file ready')
  })
})

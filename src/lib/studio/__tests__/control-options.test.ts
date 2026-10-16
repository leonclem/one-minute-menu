import { controlAssetSrc } from '../control-options'

describe('controlAssetSrc', () => {
  it('appends png when the basename has no extension', () => {
    expect(controlAssetSrc('backdrops/backdrop-soft-neutral')).toBe(
      '/studio/backdrops/backdrop-soft-neutral.png',
    )
    expect(controlAssetSrc('ui-rotate-overhead')).toBe('/studio/controls/ui-rotate-overhead.png')
  })

  it('keeps a photographic extension', () => {
    expect(controlAssetSrc('backdrops/backdrop-sunlit-kitchen.jpg')).toBe(
      '/studio/backdrops/backdrop-sunlit-kitchen.jpg',
    )
    expect(controlAssetSrc('surfaces/surface-kitchen-worktop.jpg')).toBe(
      '/studio/surfaces/surface-kitchen-worktop.jpg',
    )
  })
})

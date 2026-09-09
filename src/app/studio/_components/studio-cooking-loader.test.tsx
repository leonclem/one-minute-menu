import React from 'react'
import fs from 'fs'
import path from 'path'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

import {
  advanceKitchenLoaderTime,
  KITCHEN_LOADER_CLIP_IDS,
  KITCHEN_LOADER_CLIPS,
  nextKitchenLoaderTime,
  pickKitchenLoaderClipId,
  StudioCanvasBusyOverlay,
  StudioCookingLoader,
  resetKitchenLoaderMarkupCache,
} from './studio-cooking-loader'

const TINY_SVG = '<svg viewBox="0 0 10 10"></svg>'
const kitchen = KITCHEN_LOADER_CLIPS.kitchen
const fryingPan = KITCHEN_LOADER_CLIPS['frying-pan']
const egg = KITCHEN_LOADER_CLIPS.egg

function stubSvgClock() {
  const pause = jest.fn()
  const unpause = jest.fn()
  const setCurrentTime = jest.fn()
  const getCurrentTime = jest.fn(() => 3)
  Object.defineProperty(SVGSVGElement.prototype, 'pauseAnimations', {
    configurable: true,
    value: pause,
  })
  Object.defineProperty(SVGSVGElement.prototype, 'unpauseAnimations', {
    configurable: true,
    value: unpause,
  })
  Object.defineProperty(SVGSVGElement.prototype, 'setCurrentTime', {
    configurable: true,
    value: setCurrentTime,
  })
  Object.defineProperty(SVGSVGElement.prototype, 'getCurrentTime', {
    configurable: true,
    value: getCurrentTime,
  })
  return { pause, unpause, setCurrentTime, getCurrentTime }
}

function readLoaderSvg(filename: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'public', 'studio', 'ui', filename), 'utf8')
}

describe('pickKitchenLoaderClipId', () => {
  it('maps random values across all three clips', () => {
    expect(pickKitchenLoaderClipId(() => 0)).toBe('kitchen')
    expect(pickKitchenLoaderClipId(() => 0.4)).toBe('frying-pan')
    expect(pickKitchenLoaderClipId(() => 0.9)).toBe('egg')
    expect(pickKitchenLoaderClipId(() => 1)).toBe('egg')
    expect(KITCHEN_LOADER_CLIP_IDS).toEqual(['kitchen', 'frying-pan', 'egg'])
  })
})

describe('nextKitchenLoaderTime', () => {
  it('rewinds the kitchen clip to after the pot is already on screen', () => {
    expect(kitchen.loopStartS).toBeGreaterThan(0.8)
    expect(nextKitchenLoaderTime(0, kitchen)).toBe(kitchen.loopStartS)
    expect(nextKitchenLoaderTime(0.5, kitchen)).toBe(kitchen.loopStartS)
    expect(nextKitchenLoaderTime(kitchen.loopEndS, kitchen)).toBe(kitchen.loopStartS)
  })

  it('wraps seamless clips at their authored duration', () => {
    expect(nextKitchenLoaderTime(fryingPan.loopEndS, fryingPan)).toBe(0)
    expect(nextKitchenLoaderTime(1.2, fryingPan)).toBe(1.2)
    expect(nextKitchenLoaderTime(egg.loopEndS, egg)).toBe(0)
  })
})

describe('advanceKitchenLoaderTime', () => {
  it('advances the pot at half speed and wraps without crossing the pop-in', () => {
    expect(advanceKitchenLoaderTime(2, 1, kitchen)).toBe(2.5)
    expect(advanceKitchenLoaderTime(kitchen.loopEndS - 0.05, 0.2, kitchen)).toBe(kitchen.loopStartS)
  })

  it('advances the pan and egg clips at authored speed', () => {
    expect(advanceKitchenLoaderTime(1, 0.4, fryingPan)).toBe(1.4)
    expect(advanceKitchenLoaderTime(0.2, 0.3, egg)).toBe(0.5)
    expect(advanceKitchenLoaderTime(egg.loopEndS - 0.1, 0.2, egg)).toBe(egg.loopStartS)
  })
})

describe('kitchen loader assets', () => {
  it('uses teal cookware without opaque backdrops', () => {
    const kitchenSvg = readLoaderSvg('kitchen-loader.svg')
    expect(kitchenSvg).not.toContain('id="i0"')
    expect(kitchenSvg).toContain('#01b3bf')

    const panSvg = readLoaderSvg('frying-pan-loader.svg')
    expect(panSvg).toContain('#01b3bf')
    expect(panSvg).toContain('dur="3.017s"')

    const eggSvg = readLoaderSvg('egg-loader.svg')
    expect(eggSvg).toContain('#01b3bf')
    expect(eggSvg).not.toContain('#00838d')
    expect(eggSvg).toContain('dur="1.467s"')
  })
})

describe('StudioCookingLoader', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('loops the selected clip at half speed', async () => {
    const clock = stubSvgClock()
    render(<StudioCookingLoader svgMarkup={TINY_SVG} clipId="kitchen" />)
    await waitFor(() => {
      expect(clock.setCurrentTime).toHaveBeenCalledWith(kitchen.loopStartS)
    })
    expect(clock.pause).toHaveBeenCalled()
    expect(screen.getByTestId('studio-cooking-loader')).toHaveAttribute('data-clip', 'kitchen')
    expect(screen.getByTestId('studio-cooking-loader')).toHaveClass('h-[min(21rem,90%)]')
  })

  it('pauses on a still frame when the user prefers reduced motion', async () => {
    const clock = stubSvgClock()
    window.matchMedia = jest.fn().mockReturnValue({
      matches: true,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }) as unknown as typeof window.matchMedia

    render(<StudioCookingLoader svgMarkup={TINY_SVG} clipId="egg" />)
    await waitFor(() => {
      expect(clock.pause).toHaveBeenCalled()
    })
    expect(clock.setCurrentTime).toHaveBeenCalledWith(egg.stillS)
  })
})

describe('StudioCanvasBusyOverlay', () => {
  const originalFetch = global.fetch

  afterEach(() => {
    global.fetch = originalFetch
    resetKitchenLoaderMarkupCache()
    jest.restoreAllMocks()
  })

  it('replaces Generating copy with a randomly chosen cooking clip', async () => {
    stubSvgClock()
    jest.spyOn(Math, 'random').mockReturnValue(0.4)
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => TINY_SVG,
    }) as unknown as typeof fetch

    render(<StudioCanvasBusyOverlay mode="generating" />)
    expect(screen.getByRole('status')).toHaveTextContent('Generating…')
    expect(screen.getByText('Generating…')).toHaveClass('sr-only')
    expect(await screen.findByTestId('studio-cooking-loader')).toHaveAttribute(
      'data-clip',
      'frying-pan',
    )
    expect(global.fetch).toHaveBeenCalledWith(fryingPan.src)
  })

  it('keeps upload and analyse as text', () => {
    const { rerender } = render(<StudioCanvasBusyOverlay mode="uploading" />)
    expect(screen.getByRole('status')).toHaveTextContent('Uploading photo…')
    expect(screen.queryByTestId('studio-cooking-loader')).not.toBeInTheDocument()
    rerender(<StudioCanvasBusyOverlay mode="extracting" />)
    expect(screen.getByRole('status')).toHaveTextContent('Analysing photo…')
  })
})

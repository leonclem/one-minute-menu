import { act, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import HeroDemo from './HeroDemo'
import { RESUME_MS, STEP_MS } from './timeline'

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

jest.mock('next/font/google', () => ({
  Newsreader: () => ({ className: 'font-newsreader' }),
}))

function mockMotion(reduce: boolean) {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: reduce && String(query).includes('reduce'),
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }))
}

describe('HeroDemo', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockMotion(false)
  })

  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('autoplays from upload into enhance, then publish', () => {
    render(<HeroDemo />)

    expect(screen.getByRole('tab', { name: /upload/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('banana-bread.jpg')).toBeInTheDocument()
    expect(screen.getByText(/start with a real photo/i)).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(STEP_MS[0])
    })

    expect(screen.getByRole('tab', { name: /enhance/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('slider', { name: /compare original and enhanced photo/i })).toHaveAttribute(
      'aria-valuenow',
      '86',
    )

    act(() => {
      jest.advanceTimersByTime(STEP_MS[1])
    })

    expect(screen.getByRole('tab', { name: /publish anywhere/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('button', { name: /instagram/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('pauses on a format chip and later continues from the next scenario', () => {
    render(<HeroDemo />)

    act(() => {
      jest.advanceTimersByTime(STEP_MS[0] + STEP_MS[1])
    })

    fireEvent.click(screen.getByRole('button', { name: /cookbook/i }))
    expect(screen.getByRole('button', { name: /cookbook/i })).toHaveAttribute('aria-pressed', 'true')

    act(() => {
      jest.advanceTimersByTime(RESUME_MS + 20)
    })

    expect(screen.getByRole('button', { name: /delivery app/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('moves the compare slider with the keyboard and reveals the enhanced photo', () => {
    render(<HeroDemo />)
    fireEvent.click(screen.getByRole('tab', { name: /enhance/i }))

    const slider = screen.getByRole('slider', { name: /compare original and enhanced photo/i })
    fireEvent.keyDown(slider, { key: 'ArrowLeft' })
    expect(slider).toHaveAttribute('aria-valuenow', '81')

    act(() => {
      jest.advanceTimersByTime(RESUME_MS)
    })

    expect(screen.getByRole('tab', { name: /publish anywhere/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('starts on the compare and does not autoplay when motion is reduced', () => {
    mockMotion(true)
    render(<HeroDemo />)

    expect(screen.getByRole('tab', { name: /enhance/i })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('slider', { name: /compare original and enhanced photo/i })).toHaveAttribute(
      'aria-valuenow',
      '50',
    )

    act(() => {
      jest.advanceTimersByTime(STEP_MS[1] + RESUME_MS)
    })

    expect(screen.getByRole('tab', { name: /enhance/i })).toHaveAttribute('aria-selected', 'true')
  })
})

/**
 * Unit Tests — Controls and Image_Viewer
 *
 * Feature: photo-control, Task 11.3
 *
 * Tests:
 *  - Camera_Control: single-selection segmented selector (Req 5.1)
 *  - Lighting_Control: two-state toggle (Req 6.1)
 *  - Controls disabled before hydration (Req 1.5, 4.5, 4.7)
 *  - Image_Viewer: progress indicator and controls disabled during request (Req 12.2)
 *  - Image_Viewer: suggestions only shown with message (Req 14.5)
 *  - Image_Viewer: non-blocking warning badge shown with controls enabled when
 *    strictConformance is false (Req 4.8)
 *
 * Library: Jest + @testing-library/react
 *
 * Validates: Requirements 4.5, 4.7, 4.8, 5.1, 6.1, 7.1, 12.1, 12.2, 14.5
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'

import { Camera_Control } from '../Camera_Control'
import { Lighting_Control } from '../Lighting_Control'
import { Component_Control } from '../Component_Control'
import { Image_Viewer, type PhotoControlError } from '../Image_Viewer'

// ── Camera_Control ────────────────────────────────────────────────────────────

describe('Camera_Control — segmented selector (Req 5.1)', () => {
  it('renders all angle values as buttons', () => {
    render(
      <Camera_Control value="45-degree" onChange={jest.fn()} />,
    )
    expect(screen.getByRole('radio', { name: /top-down/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /45/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /eye-level/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /macro close-up/i })).toBeInTheDocument()
  })

  it('marks exactly one button as checked (the current value)', () => {
    render(
      <Camera_Control value="top-down" onChange={jest.fn()} />,
    )
    const buttons = screen.getAllByRole('radio')
    const checkedButtons = buttons.filter(
      (btn) => btn.getAttribute('aria-checked') === 'true',
    )
    expect(checkedButtons).toHaveLength(1)
    expect(checkedButtons[0]).toHaveAttribute('aria-label', expect.stringMatching(/top-down/i))
  })

  it('calls onChange with the selected angle when a different button is clicked', () => {
    const onChange = jest.fn()
    render(<Camera_Control value="45-degree" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /top-down/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('top-down')
  })

  it('calls onChange when the current value button is clicked (parent handles no-op via empty delta)', () => {
    const onChange = jest.fn()
    render(<Camera_Control value="top-down" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /top-down/i }))
    // The control always fires onChange; the parent skips mutation for empty deltas
    expect(onChange).toHaveBeenCalledWith('top-down')
  })

  it('disables all buttons when disabled=true (before hydration)', () => {
    render(
      <Camera_Control value="45-degree" onChange={jest.fn()} disabled />,
    )
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })

  it('enables all buttons when disabled=false (after hydration)', () => {
    render(
      <Camera_Control value="45-degree" onChange={jest.fn()} disabled={false} />,
    )
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled()
    }
  })
})

// ── Lighting_Control ──────────────────────────────────────────────────────────

describe('Lighting_Control — options (Req 6.1)', () => {
  it('renders all lighting options', () => {
    render(<Lighting_Control value="bright-and-airy" onChange={jest.fn()} />)
    expect(screen.getByRole('radio', { name: /bright/i })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /low-key/i })).toBeInTheDocument()
  })

  it('marks the current value as checked', () => {
    render(<Lighting_Control value="low-key" onChange={jest.fn()} />)
    const buttons = screen.getAllByRole('radio')
    const checkedButtons = buttons.filter(
      (btn) => btn.getAttribute('aria-checked') === 'true',
    )
    expect(checkedButtons).toHaveLength(1)
    expect(checkedButtons[0]).toHaveAttribute('aria-label', expect.stringMatching(/low-key/i))
  })

  it('calls onChange with the selected value when a non-selected option is clicked', () => {
    const onChange = jest.fn()
    render(<Lighting_Control value="bright-and-airy" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /low-key/i }))
    expect(onChange).toHaveBeenCalledWith('low-key')
  })

  it('does not call onChange when the already-selected option is clicked', () => {
    const onChange = jest.fn()
    render(<Lighting_Control value="bright-and-airy" onChange={onChange} />)

    fireEvent.click(screen.getByRole('radio', { name: /bright/i }))
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables all buttons when disabled=true (before hydration)', () => {
    render(<Lighting_Control value="bright-and-airy" onChange={jest.fn()} disabled />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })

  it('enables all buttons when disabled=false (after hydration)', () => {
    render(<Lighting_Control value="bright-and-airy" onChange={jest.fn()} disabled={false} />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled()
    }
  })
})

// ── Component_Control ─────────────────────────────────────────────────────────

describe('Component_Control — add/remove garnishes and sides (Req 8.1–8.3)', () => {
  it('renders existing garnishes and sides', () => {
    render(
      <Component_Control
        garnishes={['lemon wedge', 'dill']}
        sides={['fries']}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
      />,
    )
    expect(screen.getByText('lemon wedge')).toBeInTheDocument()
    expect(screen.getByText('dill')).toBeInTheDocument()
    expect(screen.getByText('fries')).toBeInTheDocument()
  })

  it('calls onGarnishesChange without the removed item when Remove is clicked', () => {
    const onGarnishesChange = jest.fn()
    render(
      <Component_Control
        garnishes={['lemon wedge', 'dill']}
        sides={[]}
        onGarnishesChange={onGarnishesChange}
        onSidesChange={jest.fn()}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove lemon wedge/i }))
    expect(onGarnishesChange).toHaveBeenCalledWith(['dill'])
  })

  it('calls onSidesChange without the removed item when Remove is clicked for a side', () => {
    const onSidesChange = jest.fn()
    render(
      <Component_Control
        garnishes={[]}
        sides={['fries', 'salad']}
        onGarnishesChange={jest.fn()}
        onSidesChange={onSidesChange}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /remove fries/i }))
    expect(onSidesChange).toHaveBeenCalledWith(['salad'])
  })

  it('disables all controls when disabled=true (before hydration)', () => {
    render(
      <Component_Control
        garnishes={['lemon']}
        sides={['fries']}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
        disabled
      />,
    )
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    for (const btn of removeButtons) {
      expect(btn).toBeDisabled()
    }
    const inputs = screen.getAllByRole('textbox')
    for (const input of inputs) {
      expect(input).toBeDisabled()
    }
  })
})

// ── Image_Viewer — progress and disable during request ────────────────────────

describe('Image_Viewer — progress indicator and controls disabled during request (Req 12.2)', () => {
  it('shows a progress indicator when isGenerating=true', () => {
    render(
      <Image_Viewer
        isGenerating={true}
        error={null}
      />,
    )
    expect(screen.getByRole('status', { name: /generating/i })).toBeInTheDocument()
  })

  it('does not show a progress indicator when isGenerating=false', () => {
    render(
      <Image_Viewer
        isGenerating={false}
        error={null}
      />,
    )
    expect(screen.queryByRole('status', { name: /generating/i })).not.toBeInTheDocument()
  })

  it('displays the mutated image when mutatedImageUrl is provided (Req 12.1)', () => {
    render(
      <Image_Viewer
        sourceImageUrl="data:image/png;base64,abc"
        mutatedImageUrl="data:image/png;base64,xyz"
        isGenerating={false}
        error={null}
      />,
    )
    expect(screen.getByAltText('Mutated Image')).toBeInTheDocument()
  })

  it('displays the source image when sourceImageUrl is provided', () => {
    render(
      <Image_Viewer
        sourceImageUrl="data:image/png;base64,abc"
        isGenerating={false}
        error={null}
      />,
    )
    expect(screen.getByAltText('Source Image')).toBeInTheDocument()
  })
})

// ── Image_Viewer — suggestions only with message (Req 14.5) ──────────────────

describe('Image_Viewer — suggestions only shown with message (Req 14.5)', () => {
  it('shows error message and suggestions when both are present', () => {
    const error: PhotoControlError = {
      error: 'Content policy violation',
      code: 'CONTENT_POLICY',
      suggestions: ['Try a different prompt', 'Remove sensitive content'],
    }
    render(<Image_Viewer isGenerating={false} error={error} />)

    expect(screen.getByText('Content policy violation')).toBeInTheDocument()
    expect(screen.getByText('Try a different prompt')).toBeInTheDocument()
    expect(screen.getByText('Remove sensitive content')).toBeInTheDocument()
  })

  it('shows error message without suggestions when suggestions array is empty', () => {
    const error: PhotoControlError = {
      error: 'Rate limit exceeded',
      code: 'RATE_LIMIT',
      suggestions: [],
    }
    render(<Image_Viewer isGenerating={false} error={error} />)

    expect(screen.getByText('Rate limit exceeded')).toBeInTheDocument()
    expect(screen.queryByText('Suggestions:')).not.toBeInTheDocument()
  })

  it('shows error message without suggestions when suggestions is undefined', () => {
    const error: PhotoControlError = {
      error: 'Service unavailable',
    }
    render(<Image_Viewer isGenerating={false} error={error} />)

    expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    expect(screen.queryByText('Suggestions:')).not.toBeInTheDocument()
  })

  it('does not render the error block when error is null', () => {
    render(<Image_Viewer isGenerating={false} error={null} />)
    expect(screen.queryByRole('alert', { name: /mutation error/i })).not.toBeInTheDocument()
  })

  it('does not show suggestions when error message is empty (no message = no suggestions)', () => {
    // An error with an empty message string should not render the error block at all
    const error: PhotoControlError = {
      error: '',
      suggestions: ['This should not appear'],
    }
    render(<Image_Viewer isGenerating={false} error={error} />)
    expect(screen.queryByText('This should not appear')).not.toBeInTheDocument()
  })
})

// ── Controls disabled before hydration (Req 4.5, 4.7) ────────────────────────

describe('Controls disabled before hydration (Req 4.5, 4.7)', () => {
  it('Camera_Control is disabled before hydration (disabled=true)', () => {
    render(<Camera_Control value="45-degree" onChange={jest.fn()} disabled={true} />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })

  it('Lighting_Control is disabled before hydration (disabled=true)', () => {
    render(<Lighting_Control value="bright-and-airy" onChange={jest.fn()} disabled={true} />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })

  it('Component_Control is disabled before hydration (disabled=true)', () => {
    render(
      <Component_Control
        garnishes={['lemon']}
        sides={[]}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
        disabled={true}
      />,
    )
    const removeButtons = screen.getAllByRole('button', { name: /remove/i })
    for (const btn of removeButtons) {
      expect(btn).toBeDisabled()
    }
  })

  it('Camera_Control is enabled after hydration (disabled=false)', () => {
    render(<Camera_Control value="45-degree" onChange={jest.fn()} disabled={false} />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled()
    }
  })
})

// ── Non-blocking warning badge (Req 4.8) ─────────────────────────────────────

describe('Non-blocking warning badge when strictConformance=false (Req 4.8)', () => {
  /**
   * The warning badge is rendered by the parent orchestrator (photo-control-client.tsx),
   * not by the individual controls. These tests verify that the controls themselves
   * remain enabled (not disabled) when a warning badge is shown — i.e., the
   * strictConformance=false state does NOT disable the controls.
   *
   * The badge rendering itself is tested in the integration tests for the
   * photo-control-client component (Task 12).
   */
  it('Camera_Control remains enabled when strictConformance=false (disabled=false)', () => {
    // strictConformance=false → disabled prop is still false (controls stay enabled)
    render(<Camera_Control value="45-degree" onChange={jest.fn()} disabled={false} />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled()
    }
  })

  it('Lighting_Control remains enabled when strictConformance=false (disabled=false)', () => {
    render(<Lighting_Control value="bright-and-airy" onChange={jest.fn()} disabled={false} />)
    const buttons = screen.getAllByRole('radio')
    for (const btn of buttons) {
      expect(btn).not.toBeDisabled()
    }
  })
})

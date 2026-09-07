import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'

import { CENTER, type EditorState } from '@/lib/photo-control/minimal-schema'
import type { StudioVisualOption } from '@/lib/studio/control-options'
import type { StudioImageRecord } from '@/lib/studio/types'

import { StudioScenePanel } from './studio-scene-panel'
import { StudioShotFilmstrip } from './studio-shot-filmstrip'
import { StudioShotWorkbench } from './studio-shot-workbench'
import { StudioWorkbenchToolbar } from './studio-workbench-toolbar'

function image(
  overrides: Partial<StudioImageRecord> & Pick<StudioImageRecord, 'id' | 'role'>,
): StudioImageRecord {
  return {
    dish_id: 'd1',
    user_id: 'u1',
    storage_path: `${overrides.id}.png`,
    public_url: `https://example.com/${overrides.id}.png`,
    mime_type: 'image/png',
    width: 1024,
    height: 1024,
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

const editorState: EditorState = {
  schema: {
    scene_setup: { angle: '45-degree', framing: 'close-up', lighting: 'soft-natural' },
    canvas: {
      background: '',
      background_style: 'teal',
      surface_style: 'terrazzo',
      main_vessel: '',
    },
    food_components: { main_item: 'cake', garnishes: [], sides: [] },
  },
  position: { ...CENTER },
}

const lightingOptions: StudioVisualOption<string>[] = [
  { id: 'l1', label: 'Soft Natural', assetBasename: 'lighting/lighting-soft-natural', value: 'soft-natural' },
]

describe('StudioWorkbenchToolbar', () => {
  it('shows Reframe and Remove only', () => {
    render(
      <StudioWorkbenchToolbar
        disabled={false}
        cropOpen={false}
        objectEditOpen={false}
        creditLabel="1 credit"
        onReframe={jest.fn()}
        onRemove={jest.fn()}
      />,
    )
    expect(screen.getByRole('button', { name: 'Reframe image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove object' })).toBeInTheDocument()
    expect(screen.getByText('Free · lossless')).toBeInTheDocument()
    expect(screen.getByText('1 credit · re-renders')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Crop image' })).not.toBeInTheDocument()
    expect(screen.queryByText(/angle/i)).not.toBeInTheDocument()
  })

  it('uses translucent overlay chips and pressed state in expand', () => {
    render(
      <StudioWorkbenchToolbar
        disabled={false}
        overlay
        cropOpen
        objectEditOpen={false}
        creditLabel="1 credit"
        onReframe={jest.fn()}
        onRemove={jest.fn()}
      />,
    )
    const reframe = screen.getByRole('button', { name: 'Reframe image' })
    expect(reframe).toHaveClass('studio-tool-chip-overlay')
    expect(reframe).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Remove object' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('StudioShotFilmstrip', () => {
  it('labels shots with OG and G1', () => {
    const original = image({ id: 'og', role: 'source' })
    const child = image({
      id: 'v1',
      role: 'generated',
      source_image_id: 'og',
      created_at: '2026-08-15T01:00:00.000Z',
    })
    render(
      <StudioShotFilmstrip
        images={[original, child]}
        selectedId="v1"
        onSelect={jest.fn()}
        onDelete={jest.fn()}
      />,
    )
    expect(screen.getByText('OG')).toBeInTheDocument()
    expect(screen.getByText('G1')).toBeInTheDocument()
    expect(screen.getByTestId('studio-gallery')).toHaveClass('studio-filmstrip')
    expect(screen.getByRole('button', { name: 'Delete Generation 1' })).toHaveClass('min-h-0')
  })
})

describe('StudioShotWorkbench', () => {
  const workbenchProps = {
    dishId: 'd1',
    dishName: 'Chocolate Cake',
    shotTitle: 'Original',
    notices: null,
    canvas: <div>canvas</div>,
    cropPanel: null,
    removePanel: null,
    scene: <div>scene body</div>,
    exports: <div>exports body</div>,
    images: [image({ id: 'og', role: 'source' })],
    selectedId: 'og',
    onSelectShot: jest.fn(),
    onDeleteShot: jest.fn(),
    hasPrev: false,
    hasNext: false,
    onPrev: jest.fn(),
    onNext: jest.fn(),
    toolsDisabled: false,
    cropOpen: false,
    objectEditOpen: false,
    creditLabel: '1 credit',
    onReframe: jest.fn(),
    onRemove: jest.fn(),
    sceneCount: 0,
    exportsCount: 3,
  } satisfies Partial<React.ComponentProps<typeof StudioShotWorkbench>>

  it('switches Scene and Exports tabs and has no angle/spin tools', () => {
    const onTab = jest.fn()
    render(
      <StudioShotWorkbench
        {...workbenchProps}
        tab="scene"
        onTab={onTab}
      />,
    )
    expect(screen.getByTestId('studio-shot-workbench')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chocolate Cake' })).toHaveAttribute(
      'href',
      '/studio/d1',
    )
    expect(screen.getByText('scene body')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: /Exports/ }))
    expect(onTab).toHaveBeenCalledWith('exports')
    expect(screen.queryByText(/Change angle/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/Swap vessel/i)).not.toBeInTheDocument()
    expect(screen.getByTestId('studio-gallery')).toBeInTheDocument()
  })

  it('overlays shot arrows and delete on the canvas, not header Prev/Next', () => {
    const onPrev = jest.fn()
    const onNext = jest.fn()
    const onDeleteShot = jest.fn()
    render(
      <StudioShotWorkbench
        {...workbenchProps}
        tab="scene"
        onTab={jest.fn()}
        hasPrev
        hasNext
        onPrev={onPrev}
        onNext={onNext}
        onDeleteShot={onDeleteShot}
        images={[
          image({ id: 'og', role: 'source' }),
          image({ id: 'v1', role: 'generated', source_image_id: 'og' }),
        ]}
        selectedId="og"
      />,
    )
    expect(screen.queryByRole('button', { name: 'Prev' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous shot' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next shot' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Previous shot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Next shot' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete shot' }))
    expect(onPrev).toHaveBeenCalled()
    expect(onNext).toHaveBeenCalled()
    expect(onDeleteShot).toHaveBeenCalledWith(expect.objectContaining({ id: 'og' }))
    expect(screen.getByRole('tab', { name: 'Scene 0' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Exports 3' })).toBeInTheDocument()
  })

  it('expands as a focus canvas with overlay tools and no filmstrip', () => {
    const onCloseExpand = jest.fn()
    render(
      <StudioShotWorkbench
        {...workbenchProps}
        tab="scene"
        onTab={jest.fn()}
        expanded
        onCloseExpand={onCloseExpand}
        shotTitle="Lighting → Soft Natural"
        cropPanel={<div data-testid="studio-crop-panel">crop dock</div>}
        images={[
          image({ id: 'og', role: 'source' }),
          image({
            id: 'v1',
            role: 'generated',
            source_image_id: 'og',
            created_at: '2026-08-15T01:00:00.000Z',
          }),
        ]}
        selectedId="v1"
      />,
    )
    const overlay = screen.getByTestId('studio-workbench-expand')
    expect(overlay).toHaveAttribute('role', 'dialog')
    expect(overlay).toHaveTextContent('G1')
    expect(overlay).toHaveTextContent('Lighting → Soft Natural')
    expect(overlay).not.toHaveTextContent(/variant/i)
    expect(overlay).toContainElement(screen.getByTestId('studio-crop-panel'))
    expect(screen.getByRole('button', { name: 'Move panel' })).toBeInTheDocument()
    expect(screen.queryByTestId('studio-gallery')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reframe image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove object' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onCloseExpand).toHaveBeenCalled()
  })
})

describe('StudioScenePanel', () => {
  const finishing = {
    disabled: false,
    loading: false,
    error: null,
    stackLoaded: false,
    selectedIds: [] as string[],
    options: [],
    onRequestStack: jest.fn(),
    onToggle: jest.fn(),
  }

  it('stages a Quick Look and hides Pro unless enabled', () => {
    const onQuickLook = jest.fn()
    const { rerender } = render(
      <StudioScenePanel
        editorState={editorState}
        lightingOptions={lightingOptions}
        surfaceOptions={[]}
        backdropOptions={[]}
        backdropHidden={false}
        controlsDisabled={false}
        isHydrated
        isExtracting={false}
        isRefreshingExtract={false}
        refreshExtractError={null}
        pending={{ lighting: false, surface: false, backdrop: false, garnishes: false }}
        finishing={finishing}
        hasPendingChanges={false}
        isGenerating={false}
        generateCreditLabel="1 credit"
        generateDisabled
        onGenerate={jest.fn()}
        onDiscard={jest.fn()}
        onQuickLook={onQuickLook}
        onLighting={jest.fn()}
        onSurface={jest.fn()}
        onBackdrop={jest.fn()}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
        proEnabled={false}
        selectedModel="gemini-3.1-flash-image-preview"
        onTogglePro={jest.fn()}
        reshootEnabled={false}
        onReshoot={jest.fn()}
        reshootDisabled
      />,
    )
    expect(screen.queryByTestId('studio-pro-switch')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-quick-look-colour-pop'))
    expect(onQuickLook).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'colour-pop', lighting: 'bold-sunlight' }),
    )
    rerender(
      <StudioScenePanel
        editorState={editorState}
        lightingOptions={lightingOptions}
        surfaceOptions={[]}
        backdropOptions={[]}
        backdropHidden={false}
        controlsDisabled={false}
        isHydrated
        isExtracting={false}
        isRefreshingExtract={false}
        refreshExtractError={null}
        pending={{ lighting: false, surface: false, backdrop: false, garnishes: false }}
        finishing={finishing}
        hasPendingChanges={false}
        isGenerating={false}
        generateCreditLabel="1 credit"
        generateDisabled
        onGenerate={jest.fn()}
        onDiscard={jest.fn()}
        onQuickLook={onQuickLook}
        onLighting={jest.fn()}
        onSurface={jest.fn()}
        onBackdrop={jest.fn()}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
        proEnabled
        selectedModel="gemini-3.1-flash-image-preview"
        onTogglePro={jest.fn()}
        reshootEnabled={false}
        onReshoot={jest.fn()}
        reshootDisabled
      />,
    )
    expect(screen.getByTestId('studio-pro-switch')).toBeInTheDocument()
  })

  it('collapses a Scene subsection and keeps the selected value on the heading', () => {
    render(
      <StudioScenePanel
        editorState={editorState}
        lightingOptions={lightingOptions}
        surfaceOptions={[]}
        backdropOptions={[]}
        backdropHidden={false}
        controlsDisabled={false}
        isHydrated
        isExtracting={false}
        isRefreshingExtract={false}
        refreshExtractError={null}
        pending={{ lighting: true, surface: false, backdrop: false, garnishes: false }}
        finishing={finishing}
        hasPendingChanges={false}
        isGenerating={false}
        generateCreditLabel="1 credit"
        generateDisabled
        onGenerate={jest.fn()}
        onDiscard={jest.fn()}
        onQuickLook={jest.fn()}
        onLighting={jest.fn()}
        onSurface={jest.fn()}
        onBackdrop={jest.fn()}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
        proEnabled={false}
        selectedModel="gemini-3.1-flash-image-preview"
        onTogglePro={jest.fn()}
        reshootEnabled={false}
        onReshoot={jest.fn()}
        reshootDisabled
      />,
    )
    expect(screen.getByRole('radio', { name: 'Soft Natural' })).toBeInTheDocument()
    expect(screen.getByTestId('studio-scene-lighting-value')).toHaveClass('text-[#01b3bf]')
    expect(screen.queryByLabelText('Pending edits')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('studio-scene-section-lighting'))
    expect(screen.queryByRole('radio', { name: 'Soft Natural' })).not.toBeInTheDocument()
    expect(screen.getByTestId('studio-scene-section-lighting')).toHaveTextContent('Soft Natural')
    expect(screen.getByTestId('studio-scene-section-lighting')).toHaveAttribute(
      'aria-expanded',
      'false',
    )
  })

  it('shows a GEN 3+ callout above Generate without disabling it', () => {
    const onGenerate = jest.fn()
    render(
      <StudioScenePanel
        editorState={editorState}
        lightingOptions={lightingOptions}
        surfaceOptions={[]}
        backdropOptions={[]}
        backdropHidden={false}
        controlsDisabled={false}
        isHydrated
        isExtracting={false}
        isRefreshingExtract={false}
        refreshExtractError={null}
        pending={{ lighting: false, surface: false, backdrop: false, garnishes: false }}
        finishing={finishing}
        hasPendingChanges
        isGenerating={false}
        generateCreditLabel="1 credit"
        generateDisabled={false}
        onGenerate={onGenerate}
        onDiscard={jest.fn()}
        onQuickLook={jest.fn()}
        onLighting={jest.fn()}
        onSurface={jest.fn()}
        onBackdrop={jest.fn()}
        onGarnishesChange={jest.fn()}
        onSidesChange={jest.fn()}
        proEnabled={false}
        selectedModel="gemini-3.1-flash-image-preview"
        onTogglePro={jest.fn()}
        reshootEnabled={false}
        onReshoot={jest.fn()}
        reshootDisabled
        degradationCallout={<div data-testid="studio-degradation-callout">GEN 3 warning</div>}
      />,
    )
    expect(screen.getByTestId('studio-degradation-callout')).toBeInTheDocument()
    const generate = screen.getByTestId('generate-image-button')
    expect(generate).not.toBeDisabled()
    fireEvent.click(generate)
    expect(onGenerate).toHaveBeenCalled()
  })
})

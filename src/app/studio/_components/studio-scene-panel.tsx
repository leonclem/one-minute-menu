'use client'

import { useState } from 'react'

import { Component_Control } from '@/components/photo-controls'
import type { EditorState } from '@/lib/photo-control/minimal-schema'
import { controlAssetSrc, type StudioVisualOption } from '@/lib/studio/control-options'
import { STUDIO_QUICK_LOOKS, type StudioQuickLook } from '@/lib/studio/quick-looks'
import type { FinishingTouchCatalogueItem } from '@/lib/studio/finishing-touches'
import { STUDIO_PRO_MODEL } from '@/lib/studio/model-config'
import {
  cameraHeightLabel,
  isOverheadAngle,
  verticalSwitchLabel,
} from '@/lib/studio/vertical-switch'

import { StudioFinishingTouchesControl } from './studio-finishing-touches'
import {
  matchingQuickLookName,
  optionLabel,
  plateSummary,
  SceneSection,
} from './studio-scene-section'
import { VisualOptionTiles } from './visual-option-tiles'

/** Flip to restore the Quick Looks accordion. Kept off until combinations are settled. */
const SHOW_QUICK_LOOKS = false

type SceneSectionId = 'looks' | 'camera' | 'elements' | 'lighting' | 'surface' | 'backdrop'

interface StudioScenePanelProps {
  editorState: EditorState
  lightingOptions: StudioVisualOption<string>[]
  surfaceOptions: StudioVisualOption<string>[]
  backdropOptions: StudioVisualOption<string>[]
  backdropHidden: boolean
  controlsDisabled: boolean
  isHydrated: boolean
  isExtracting: boolean
  isRefreshingExtract: boolean
  refreshExtractError: string | null
  pending: {
    lighting: boolean
    surface: boolean
    backdrop: boolean
    garnishes: boolean
    camera?: boolean
  }
  finishing: {
    disabled: boolean
    loading: boolean
    error: string | null
    stackLoaded: boolean
    selectedIds: string[]
    options: FinishingTouchCatalogueItem[]
    onRequestStack: () => void
    onToggle: (id: string) => void
  }
  hasPendingChanges: boolean
  isGenerating: boolean
  generateCreditLabel: string
  generateDisabled: boolean
  onGenerate: () => void
  onDiscard: () => void
  onQuickLook: (look: StudioQuickLook) => void
  onLighting: (value: string) => void
  onSurface: (value: string) => void
  onBackdrop: (value: string) => void
  onGarnishesChange: (garnishes: string[]) => void
  onSidesChange: (sides: string[]) => void
  proEnabled: boolean
  selectedModel: string
  onTogglePro: () => void
  reshootEnabled: boolean
  onReshoot: () => void
  reshootDisabled: boolean
  verticalSwitchEnabled?: boolean
  workingAngle?: string
  onVerticalSwitch?: () => void
}

export function StudioScenePanel({
  editorState,
  lightingOptions,
  surfaceOptions,
  backdropOptions,
  backdropHidden,
  controlsDisabled,
  isHydrated,
  isExtracting,
  isRefreshingExtract,
  refreshExtractError,
  pending,
  finishing,
  hasPendingChanges,
  isGenerating,
  generateCreditLabel,
  generateDisabled,
  onGenerate,
  onDiscard,
  onQuickLook,
  onLighting,
  onSurface,
  onBackdrop,
  onGarnishesChange,
  onSidesChange,
  proEnabled,
  selectedModel,
  onTogglePro,
  reshootEnabled,
  onReshoot,
  reshootDisabled,
  verticalSwitchEnabled = false,
  workingAngle = '45-degree',
  onVerticalSwitch,
}: StudioScenePanelProps) {
  const [openSection, setOpenSection] = useState<SceneSectionId | null>('elements')
  const toggle = (id: SceneSectionId) => {
    setOpenSection((current) => (current === id ? null : id))
  }
  const isPro = selectedModel === STUDIO_PRO_MODEL

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden"
      data-testid="studio-scene-panel"
    >
      <div className="studio-scroll min-h-0 flex-1 space-y-1 overflow-y-auto p-3 sm:p-4">
        <p className="mb-3 text-xs leading-5 text-white/55">
          Scene changes create a new shot. This one is never overwritten.
        </p>

        {SHOW_QUICK_LOOKS ? (
          <SceneSection
            id="studio-scene-looks"
            title="Quick Looks"
            selectedLabel={matchingQuickLookName(editorState, backdropHidden)}
            open={openSection === 'looks'}
            onToggle={() => toggle('looks')}
          >
            <div className="grid grid-cols-2 gap-2">
              {STUDIO_QUICK_LOOKS.map((look) => (
                <button
                  key={look.id}
                  type="button"
                  data-testid={`studio-quick-look-${look.id}`}
                  disabled={controlsDisabled}
                  className="overflow-hidden rounded-[11px] border border-white/[0.1] bg-white/[0.03] text-left hover:border-white/[0.16] disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => onQuickLook(look)}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={controlAssetSrc(look.assetBasename)}
                    alt=""
                    className="h-16 w-full object-cover"
                  />
                  <span className="block truncate px-2 py-1.5 text-xs font-bold text-white">
                    {look.name}
                  </span>
                </button>
              ))}
            </div>
          </SceneSection>
        ) : null}

        {!isHydrated && !isExtracting ? (
          <p className="py-3 text-sm text-white/40">Open a shot to enable Scene controls.</p>
        ) : (
          <>
            {verticalSwitchEnabled ? (
              <SceneSection
                id="studio-scene-camera"
                title="Camera"
                selectedLabel={cameraHeightLabel(editorState.schema.scene_setup.angle)}
                pending={pending.camera}
                open={openSection === 'camera'}
                onToggle={() => toggle('camera')}
              >
                <button
                  type="button"
                  data-testid="studio-vertical-switch"
                  className="studio-option-tile flex w-full items-center justify-between gap-3 rounded-[11px] border border-white/[0.1] bg-white/[0.03] p-3 text-left text-sm font-medium text-white hover:border-white/[0.16] focus:outline-none focus:ring-2 focus:ring-[#01b3bf]/40 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={controlsDisabled}
                  onClick={onVerticalSwitch}
                >
                  {verticalSwitchLabel(workingAngle)}
                </button>
                <p className="mt-2 text-xs leading-5 text-white/45">
                  {isOverheadAngle(workingAngle)
                    ? 'This shot looks straight down. Generate a 45° view of the same dish.'
                    : 'Generate an overhead view of the same dish, looking straight down.'}
                </p>
              </SceneSection>
            ) : null}
            <SceneSection
              id="studio-scene-plate"
              title="Elements"
              selectedLabel={plateSummary(
                editorState.schema.food_components.garnishes,
                editorState.schema.food_components.sides,
                finishing.selectedIds.length,
              )}
              pending={pending.garnishes}
              open={openSection === 'elements'}
              onToggle={() => toggle('elements')}
            >
              {isRefreshingExtract ? (
                <p className="text-xs text-white/40" role="status">
                  Updating dish details…
                </p>
              ) : null}
              {refreshExtractError ? (
                <p className="text-xs text-[#f8bc02]" role="status">
                  Dish details could not be refreshed. You can still Generate lighting and surface.
                </p>
              ) : null}
              <div className="studio-on-plate">
                <Component_Control
                  garnishes={editorState.schema.food_components.garnishes}
                  sides={editorState.schema.food_components.sides}
                  allowAdd={false}
                  disabled={controlsDisabled}
                  onGarnishesChange={onGarnishesChange}
                  onSidesChange={onSidesChange}
                />
              </div>
              <div className="mt-4">
                <StudioFinishingTouchesControl {...finishing} />
              </div>
            </SceneSection>

            <SceneSection
              id="studio-scene-lighting"
              title="Lighting"
              selectedLabel={optionLabel(lightingOptions, editorState.schema.scene_setup.lighting)}
              pending={pending.lighting}
              open={openSection === 'lighting'}
              onToggle={() => toggle('lighting')}
            >
              <VisualOptionTiles
                options={lightingOptions}
                value={editorState.schema.scene_setup.lighting}
                disabled={controlsDisabled}
                ariaLabel="Lighting"
                onChange={onLighting}
              />
            </SceneSection>

            <SceneSection
              id="studio-scene-surface"
              title="Surface"
              selectedLabel={optionLabel(surfaceOptions, editorState.schema.canvas.surface_style)}
              pending={pending.surface}
              open={openSection === 'surface'}
              onToggle={() => toggle('surface')}
            >
              {surfaceOptions.length === 0 ? (
                <p className="text-xs text-white/40">No surfaces available yet.</p>
              ) : (
                <VisualOptionTiles
                  options={surfaceOptions}
                  value={editorState.schema.canvas.surface_style ?? ''}
                  disabled={controlsDisabled}
                  ariaLabel="Surface"
                  onChange={onSurface}
                />
              )}
            </SceneSection>

            <SceneSection
              id="studio-scene-backdrop"
              title="Backdrop"
              selectedLabel={
                backdropHidden
                  ? 'Unavailable'
                  : optionLabel(backdropOptions, editorState.schema.canvas.background_style)
              }
              pending={pending.backdrop}
              open={openSection === 'backdrop'}
              onToggle={() => toggle('backdrop')}
            >
              {backdropHidden ? (
                <p role="status" className="text-xs text-[#f8bc02]">
                  {isOverheadAngle(workingAngle)
                    ? 'Overhead shots do not show a wall behind the dish, so backdrop changes are unavailable.'
                    : 'No vertical backdrop was detected in this photo, so backdrop changes are unavailable.'}
                </p>
              ) : null}
              <div className={backdropHidden ? 'mt-2' : undefined}>
                {backdropOptions.length === 0 ? (
                  <p className="text-xs text-white/40">No studio backdrops available yet.</p>
                ) : (
                  <VisualOptionTiles
                    options={backdropOptions}
                    value={editorState.schema.canvas.background_style ?? ''}
                    disabled={controlsDisabled || backdropHidden}
                    ariaLabel="Backdrop"
                    onChange={onBackdrop}
                  />
                )}
              </div>
            </SceneSection>
          </>
        )}
      </div>

      <div className="shrink-0 border-t border-white/[0.1] p-3">
        <div className="flex flex-wrap items-center justify-end gap-2">
          {reshootEnabled ? (
            <button
              type="button"
              data-testid="reshoot-image-button"
              className="studio-btn-ghost px-2.5 py-1.5 text-xs"
              disabled={reshootDisabled}
              onClick={onReshoot}
            >
              Re-shoot
            </button>
          ) : null}
          {hasPendingChanges && !isGenerating ? (
            <button type="button" className="studio-btn-ghost px-2.5 py-1.5 text-xs" onClick={onDiscard}>
              Discard
            </button>
          ) : null}
          <div className="flex min-w-0 items-center justify-end gap-2.5">
            {proEnabled ? (
              <button
                type="button"
                role="switch"
                aria-checked={isPro}
                aria-label={isPro ? 'Using Pro. Switch to Std' : 'Using Std. Switch to Pro'}
                data-testid="studio-pro-switch"
                disabled={controlsDisabled}
                className="inline-flex shrink-0 items-center gap-1 bg-transparent px-0 py-1 text-[11px] font-semibold tracking-wide text-white/35 hover:text-white/55 disabled:cursor-not-allowed disabled:opacity-50"
                onClick={onTogglePro}
              >
                <span className={isPro ? 'text-white/35' : 'text-white/80'}>Std</span>
                <span aria-hidden className="text-white/20">
                  |
                </span>
                <span className={isPro ? 'text-white/80' : 'text-white/35'}>Pro</span>
              </button>
            ) : null}
            <button
              type="button"
              data-testid="generate-image-button"
              aria-label={isGenerating ? 'Generating' : `Generate new shot, ${generateCreditLabel}`}
              disabled={generateDisabled}
              className="studio-btn-primary px-3 py-1.5 text-xs"
              onClick={onGenerate}
            >
              {isGenerating ? 'Generating…' : `Generate new shot · ${generateCreditLabel}`}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

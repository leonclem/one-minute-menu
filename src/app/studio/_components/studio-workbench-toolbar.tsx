'use client'

import { StudioCropLauncher } from './studio-crop'
import { StudioObjectEditLauncher } from './studio-object-edit'

interface StudioWorkbenchToolbarProps {
  disabled: boolean
  cropOpen: boolean
  objectEditOpen: boolean
  creditLabel: string
  overlay?: boolean
  onReframe: () => void
  onRemove: () => void
}

export function StudioWorkbenchToolbar({
  disabled,
  cropOpen,
  objectEditOpen,
  creditLabel,
  overlay = false,
  onReframe,
  onRemove,
}: StudioWorkbenchToolbarProps) {
  return (
    <div
      className={overlay ? 'flex flex-col items-stretch gap-1.5' : 'flex flex-wrap items-stretch gap-2'}
      data-testid="studio-workbench-toolbar"
    >
      <StudioCropLauncher
        disabled={disabled}
        overlay={overlay}
        pressed={cropOpen}
        hint={cropOpen ? 'Drag the window · free' : 'Free · lossless'}
        onOpen={onReframe}
      />
      <StudioObjectEditLauncher
        disabled={disabled}
        overlay={overlay}
        pressed={objectEditOpen}
        hint={
          objectEditOpen
            ? `Tap or draw · ${creditLabel}`
            : `${creditLabel} · re-renders`
        }
        onOpen={onRemove}
      />
    </div>
  )
}

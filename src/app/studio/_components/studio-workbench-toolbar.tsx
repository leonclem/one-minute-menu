'use client'

import { StudioCropLauncher } from './studio-crop'
import { StudioExpandLauncher } from './studio-expand'
import { StudioObjectEditLauncher } from './studio-object-edit'

interface StudioWorkbenchToolbarProps {
  disabled: boolean
  cropOpen: boolean
  expandOpen: boolean
  objectEditOpen: boolean
  creditLabel: string
  overlay?: boolean
  onReframe: () => void
  onExpand: () => void
  onRemove: () => void
}

export function StudioWorkbenchToolbar({
  disabled,
  cropOpen,
  expandOpen,
  objectEditOpen,
  creditLabel,
  overlay = false,
  onReframe,
  onExpand,
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
      <StudioExpandLauncher
        disabled={disabled}
        overlay={overlay}
        pressed={expandOpen}
        hint={expandOpen ? 'Drag a corner · snap' : `${creditLabel} · zoom out`}
        onOpen={onExpand}
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

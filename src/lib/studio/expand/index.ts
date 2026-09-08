export {
  DEFAULT_EXPAND_LAYOUT,
  DEFAULT_EXPAND_PRESET,
  EXPAND_HANDLE_HINT,
  EXPAND_HELPER_TEXT,
  EXPAND_LAYOUTS,
  EXPAND_LAYOUT_IDS,
  EXPAND_MAX_PAD_RATIO,
  EXPAND_PRESETS,
  EXPAND_PRESET_IDS,
  expandLayoutDef,
  expandLayoutLabel,
  expandPresetDef,
  expandPresetLabel,
  expandShotTitle,
  isExpandLayoutId,
  isExpandPresetId,
  parseExpandLayout,
  parseExpandPreset,
  type ExpandLayoutDef,
  type ExpandLayoutId,
  type ExpandPresetDef,
  type ExpandPresetId,
} from './presets'

export { nearestFlashAspectRatio, FLASH_ASPECT_RATIOS, type FlashAspectRatio } from './aspect'

export { buildExpandScenePrompt } from './prompt'

export {
  buildExpandChildMetadata,
  readExpandLayout,
  readExpandPreset,
  type StudioExpandChildMetadata,
} from './metadata'

export {
  EXPAND_CORNER_HANDLES,
  EXPAND_EDGE_HANDLES,
  expandDestinationInset,
  expandDestinationScale,
  expandGestureFromPointer,
  expandLayoutFromHandle,
  expandPhotoInset,
  expandPhotoRect,
  expandPhotoScale,
  expandPresetFromPointer,
  snapExpandPreset,
  type ExpandCornerHandle,
  type ExpandEdgeHandle,
  type ExpandHandle,
  type ExpandPhotoRect,
} from './overlay'

// padExpandCanvas / sharp stay in ./canvas — do not re-export them here.
// This barrel is imported from client components (lineage, workbench overlay).

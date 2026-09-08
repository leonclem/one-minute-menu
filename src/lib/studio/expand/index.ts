export {
  DEFAULT_EXPAND_PRESET,
  EXPAND_HELPER_TEXT,
  EXPAND_MAX_PAD_RATIO,
  EXPAND_PRESETS,
  EXPAND_PRESET_IDS,
  expandPresetDef,
  expandPresetLabel,
  isExpandPresetId,
  parseExpandPreset,
  type ExpandPresetDef,
  type ExpandPresetId,
} from './presets'

export { nearestFlashAspectRatio, FLASH_ASPECT_RATIOS, type FlashAspectRatio } from './aspect'

export { buildExpandScenePrompt } from './prompt'

export {
  buildExpandChildMetadata,
  readExpandPreset,
  type StudioExpandChildMetadata,
} from './metadata'

export {
  EXPAND_CORNER_HANDLES,
  expandDestinationInset,
  expandDestinationScale,
  expandPhotoInset,
  expandPhotoScale,
  expandPresetFromPointer,
  snapExpandPreset,
  type ExpandCornerHandle,
} from './overlay'

// padExpandCanvas / sharp stay in ./canvas — do not re-export them here.
// This barrel is imported from client components (lineage, workbench overlay).

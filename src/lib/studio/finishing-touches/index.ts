export {
  DEFAULT_FINISHING_TOUCH_LEVEL,
  FINISHING_TOUCH_CATALOGUE,
  CAKE_FINISHING_TOUCH_CATALOGUE,
  ALL_FINISHING_TOUCH_CATALOGUE,
  MAX_FINISHING_TOUCH_LEVEL,
  getFinishingTouchById,
  getFinishingTouchByName,
  stackFromIds,
  finishingTouchFamily,
  type FinishingTouchCatalogueItem,
  type FinishingTouchFamily,
  type FinishingTouchPlacement,
  type FinishingTouchPrep,
} from './catalogue'
export {
  applyFinishingTouchesLevel,
  clampFinishingTouchLevel,
  cloneMinimalSchema,
  finishingTouchLevelOptions,
} from './apply-level'
export {
  GENERIC_FINISHING_TOUCH_STACK_IDS,
  GENERIC_CAKE_FINISHING_TOUCH_STACK_IDS,
  fallbackFinishingTouchStack,
  sanitizeRecommendedStackIds,
} from './rank'
export {
  parseFinishingTouchesMetadata,
  finishingTouchesCountBucket,
  type FinishingTouchesMetadata,
} from './metadata'
export {
  buildFinishingTouchesAdditionClause,
  finishingTouchRemovalFillPhrase,
} from './directive'
export {
  isFinishingTouchesStaged,
  editorStateWithFinishingTouches,
  countStudioPendingChanges,
} from './stage'

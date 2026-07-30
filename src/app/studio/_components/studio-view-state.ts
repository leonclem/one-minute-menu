/**
 * Customer-safe view states shared by the Studio surfaces.
 *
 * This module deliberately contains only fixed copy. Internal upload,
 * extraction, generation, and feedback errors must be mapped to one of these
 * descriptors before they reach a customer-facing component.
 */

export const STUDIO_SURFACES = [
  'upload',
  'extraction',
  'generation',
  'gallery',
  'feedback',
] as const

export type StudioSurface = (typeof STUDIO_SURFACES)[number]

export const STUDIO_PHASES = ['idle', 'loading', 'error', 'empty', 'ready'] as const

export type StudioViewPhase = (typeof STUDIO_PHASES)[number]

export type StudioViewKind = 'first-run' | 'gallery'

export interface StudioViewDescriptor {
  readonly surface: StudioSurface
  readonly phase: StudioViewPhase
  readonly message: string
  readonly role: 'status' | 'alert'
  readonly retryable: boolean
  readonly retryLabel: string | null
}

export interface StudioViewSelection {
  readonly view: StudioViewKind
  readonly showFirstRun: boolean
  readonly showGallery: boolean
}

const descriptor = (
  surface: StudioSurface,
  phase: StudioViewPhase,
  message: string,
  retryable = false,
): StudioViewDescriptor => ({
  surface,
  phase,
  message,
  role: phase === 'error' ? 'alert' : 'status',
  retryable,
  retryLabel: retryable ? 'Try again' : null,
})

export const STUDIO_VIEW_DESCRIPTORS: Readonly<
  Record<StudioSurface, Readonly<Record<StudioViewPhase, StudioViewDescriptor>>>
> = {
  upload: {
    idle: descriptor('upload', 'idle', 'Choose a dish photo to begin.'),
    loading: descriptor('upload', 'loading', 'Uploading your dish photo…'),
    error: descriptor('upload', 'error', "We couldn't upload that photo. Try again.", true),
    empty: descriptor('upload', 'empty', 'No dish photo has been added yet.'),
    ready: descriptor('upload', 'ready', 'Your dish photo is ready for editing.'),
  },
  extraction: {
    idle: descriptor('extraction', 'idle', 'Your photo is ready to be understood.'),
    loading: descriptor('extraction', 'loading', 'Reading the dish details from your photo…'),
    error: descriptor('extraction', 'error', "We couldn't read the dish details. Try again.", true),
    empty: descriptor('extraction', 'empty', 'Dish details will appear after your photo is added.'),
    ready: descriptor('extraction', 'ready', 'Your dish details are ready.'),
  },
  generation: {
    idle: descriptor('generation', 'idle', 'Choose controlled changes when you are ready to create a version.'),
    loading: descriptor('generation', 'loading', 'Creating your updated dish image…'),
    error: descriptor('generation', 'error', "We couldn't create that version. Try again.", true),
    empty: descriptor('generation', 'empty', 'Make a change to create a dish image.'),
    ready: descriptor('generation', 'ready', 'Your new dish image is ready.'),
  },
  gallery: {
    idle: descriptor('gallery', 'idle', 'Your Studio images will appear here.'),
    loading: descriptor('gallery', 'loading', 'Loading your Studio images…'),
    error: descriptor('gallery', 'error', "We couldn't load your Studio images. Try again.", true),
    empty: descriptor('gallery', 'empty', 'Your Studio gallery is empty.'),
    ready: descriptor('gallery', 'ready', 'Your Studio gallery is ready.'),
  },
  feedback: {
    idle: descriptor('feedback', 'idle', 'Share optional feedback about your dish image.'),
    loading: descriptor('feedback', 'loading', 'Saving your feedback…'),
    error: descriptor('feedback', 'error', "We couldn't save your feedback. Try again.", true),
    empty: descriptor('feedback', 'empty', 'No feedback has been added yet.'),
    ready: descriptor('feedback', 'ready', 'Your feedback is saved.'),
  },
}

/**
 * Return the fixed customer-safe descriptor for a Studio surface and phase.
 */
export function getStudioViewDescriptor(
  surface: StudioSurface,
  phase: StudioViewPhase,
): StudioViewDescriptor {
  return STUDIO_VIEW_DESCRIPTORS[surface][phase]
}

/**
 * Select the first-run panel until the user owns at least one Studio image.
 * Accepting a collection as well as a count keeps call sites concise while
 * keeping the decision independent from image contents.
 */
export function selectStudioView(
  gallery: number | ReadonlyArray<unknown>,
): StudioViewKind {
  const gallerySize = typeof gallery === 'number' ? gallery : gallery.length
  return gallerySize > 0 ? 'gallery' : 'first-run'
}

/**
 * Return explicit mutually-exclusive flags for conditional UI rendering.
 */
export function getStudioViewSelection(
  gallery: number | ReadonlyArray<unknown>,
): StudioViewSelection {
  const view = selectStudioView(gallery)
  return {
    view,
    showFirstRun: view === 'first-run',
    showGallery: view === 'gallery',
  }
}

/** Backwards-compatible descriptive alias for callers that prefer “resolve”. */
export const resolveStudioView = selectStudioView

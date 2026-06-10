/**
 * Photo Control — client-side edit batching limits.
 *
 * Caps how many distinct attribute changes can be batched into a single
 * mutation prompt. Session prompt counting is tracked in the UI for now;
 * non-admin usage will eventually tie to package quotas (see /pricing).
 */

/** Maximum distinct attribute changes per apply/submit. */
export const MAX_PENDING_CHANGES = 3

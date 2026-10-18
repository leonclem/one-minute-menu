/**
 * Placement copy defaults to the table already in the photograph.
 * Once surface is itself a target, those words contradict target.surface and
 * the model keeps the old tabletop.
 */
export function harmonizeTabletopLanguage(text: string, surfaceChanging: boolean): string {
  if (!surfaceChanging) return text
  return text
    .replace(/the existing tabletop/g, 'the tabletop')
    .replace(/existing tabletop/g, 'the tabletop')
    .replace(/the current tabletop/g, 'the tabletop')
    .replace(/current tabletop/g, 'the tabletop')
}

/** Backdrop only. "Existing backdrop" is read as the whole background, table included. */
export const BACKDROP_BEHIND_TABLE_LOCK = 'Keep the backdrop behind the table unchanged.'

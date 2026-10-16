/**
 * Fixed prop vocabulary for the Studio Scene prototype.
 * The picker shows the label. The model receives description and placement only.
 */

export interface StudioProp {
  id: string
  label: string
  description: string
  placement: string
}

export const STUDIO_PROPS: readonly StudioProp[] = [
  {
    id: 'folded-napkin',
    label: 'Folded napkin',
    description:
      'One unused ivory linen napkin, folded into a plain flat rectangle about 12 cm by 8 cm, with a visible hem and a matte woven texture. No embroidery, monogram, napkin ring, or decorative fold.',
    placement:
      'Lay it on the existing tabletop beside the vessel, not underneath the vessel and not touching the food.',
  },
  {
    id: 'unfolded-napkin',
    label: 'Unfolded napkin',
    description:
      'One unused ivory linen napkin, opened flat into a square about 40 cm on each side, with a soft wrinkle and a visible hem. No embroidery, monogram, or napkin ring.',
    placement:
      'Lay it flat on the existing tabletop beside the vessel, not underneath the vessel and not covering the food.',
  },
  {
    id: 'fork',
    label: 'Fork',
    description:
      'One plain stainless-steel dinner fork with four straight tines and a smooth unadorned handle. No pattern, no gold colour, and no black handle.',
    placement:
      'Place it on the existing tabletop to the left of the vessel, tines pointing away from the near edge and the handle toward the near edge. Do not add a knife.',
  },
  {
    id: 'knife-and-fork',
    label: 'Knife and fork',
    description:
      'One matching pair of plain stainless-steel cutlery: a dinner knife with a rounded tip and a smooth handle, and a four-tine dinner fork with a smooth handle. No pattern, no gold colour, and no black handles.',
    placement:
      'Place them as a setting on the existing tabletop, the fork to the left of the vessel and the knife to the right, handles toward the near edge.',
  },
  {
    id: 'ramekin-nuts',
    label: 'Ramekin of nuts',
    description:
      'One small round white ceramic ramekin, about 8 cm across, with a plain matte finish and no pattern or logo. It is filled level with whole cashews and whole almonds. No nuts outside the ramekin.',
    placement:
      'Set the ramekin on the existing tabletop beside the vessel, not on the plate and not on the food.',
  },
  {
    id: 'salt-shaker',
    label: 'Salt shaker',
    description:
      'One clear glass salt shaker with a cylindrical body, a silver-coloured metal screw top with small holes, and visible white salt inside. No pepper, no wooden mill, and no logo.',
    placement: 'Stand it on the existing tabletop beside the vessel.',
  },
  {
    id: 'salt-and-pepper',
    label: 'Salt and pepper',
    description:
      'Two matching clear glass shakers with cylindrical bodies and silver-coloured metal screw tops. One contains white salt. The other contains whole black peppercorns. No wooden mills and no logos.',
    placement: 'Stand them together on the existing tabletop beside the vessel.',
  },
  {
    id: 'yellow-pepper',
    label: 'Yellow pepper',
    description:
      'One whole fresh yellow bell pepper, glossy, uncut, with a short green stem. Not sliced, not a chilli, and not orange or red.',
    placement:
      'Set it on the existing tabletop beside the vessel. Do not place it on the food and do not cut it.',
  },
]

const BY_ID = new Map(STUDIO_PROPS.map((prop) => [prop.id, prop]))

export function getStudioProp(id: string): StudioProp | null {
  return BY_ID.get(id) ?? null
}

/** Catalogue order is ignored. Selection order is preserved, and unknown ids are dropped. */
export function propsFromIds(ids: readonly string[]): StudioProp[] {
  const seen = new Set<string>()
  const props: StudioProp[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    const prop = getStudioProp(id)
    if (!prop) continue
    seen.add(id)
    props.push(prop)
  }
  return props
}

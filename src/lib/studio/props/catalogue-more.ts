import type { StudioProp } from './catalogue'

const BEHIND_THE_DISH =
  'Set it on the existing tabletop behind the vessel, farther from the camera than the dish. Keep it secondary and slightly softer in focus. Do not cover the food, widen the frame, or replace the backdrop.'

/**
 * Later props. Descriptions stay specific so the model does not invent a second subject.
 */
export const STUDIO_PROP_MORE: readonly StudioProp[] = [
  {
    id: 'folded-tea-towel',
    label: 'Folded tea towel',
    group: 'service',
    audience: 'any',
    description:
      'One plain oatmeal linen tea towel, folded into a thick rectangle about 20 cm by 14 cm, with a visible hem and a slightly soft fold. Clean, not stained, not a napkin, and not embroidered.',
    placement:
      'Lay it on the existing tabletop beside the vessel, not underneath the vessel and not touching the food.',
  },
  {
    id: 'candle',
    label: 'Candle',
    group: 'service',
    audience: 'any',
    description:
      'One short cream beeswax pillar, about 7 cm tall, with a small steady flame and no smoke, wax drips, or holder. The flame belongs to the candle and does not change the lighting of the dish.',
    placement:
      'Stand it on the existing tabletop to the side and slightly behind the vessel. Do not cover the food or relight the scene.',
  },
  {
    id: 'bunch-of-bananas',
    label: 'Bunch of bananas',
    group: 'ingredients',
    audience: 'cake',
    description:
      'A small hand of three yellow bananas joined at the crown, with a few small brown freckles. Not sliced, not a single banana, not a plantain, and no leaves.',
    placement:
      'Rest the bunch on the existing tabletop beside the vessel. Do not place it on the food and do not cut it.',
  },
  {
    id: 'flour-dust',
    label: 'Flour dusting',
    group: 'baking',
    audience: 'cake',
    description:
      'A light irregular dusting of white flour on the table, a few soft streaks and a faint scatter left after baking. Not a pile, not a bag of flour, not a ring around the plate, and not a new tabletop material.',
    placement:
      'Keep the flour on the open tabletop beside the vessel. Do not dust the food, the vessel, or the area directly under the vessel. Do not replace the tabletop.',
  },
  {
    id: 'whole-eggs',
    label: 'Whole eggs',
    group: 'baking',
    audience: 'cake',
    description:
      'Two whole uncracked light-brown eggs with matte shells, touching each other. No carton, no cracks, no loose shell, and no flour on them.',
    placement:
      'Set them on the existing tabletop beside the bake, not on the food and not in front of the vessel.',
  },
  {
    id: 'rolling-pin',
    label: 'Small rolling pin',
    group: 'baking',
    audience: 'cake',
    description:
      'One small pale beech rolling pin, about 20 cm long, with plain handles and only a faint trace of flour on the wood. No pile of flour and no dough.',
    placement:
      'Lay it on the existing tabletop beside the vessel, clear of the food.',
  },
  {
    id: 'olive-branch',
    label: 'Olive branch',
    group: 'greenery',
    audience: 'any',
    description:
      'A few woody stems of olive with narrow silvery-green leaves, about 24 cm tall, in a small matte stone bottle. No olives, no flowers, and not a mixed bouquet.',
    placement: BEHIND_THE_DISH,
  },
  {
    id: 'eucalyptus',
    label: 'Eucalyptus',
    group: 'greenery',
    audience: 'any',
    description:
      'A few slender stems of round grey-green eucalyptus leaves, about 26 cm tall, in a small clear glass bottle. Sparse, not a florist bunch, and not dried grasses.',
    placement: BEHIND_THE_DISH,
  },
]

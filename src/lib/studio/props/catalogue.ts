/**
 * Fixed prop vocabulary for the Studio Scene prototype.
 * The picker shows the label. The model receives description and placement only.
 */

import type { FinishingTouchFamily } from '@/lib/studio/finishing-touches/catalogue'

export type StudioPropGroup = 'cutlery' | 'service' | 'ingredients' | 'baking' | 'greenery'
export type StudioPropAudience = FinishingTouchFamily | 'any'

export const STUDIO_PROP_GROUP_ORDER: readonly StudioPropGroup[] = [
  'cutlery',
  'baking',
  'service',
  'ingredients',
  'greenery',
]

export const STUDIO_PROP_GROUP_LABELS: Record<StudioPropGroup, string> = {
  cutlery: 'Cutlery & tools',
  baking: 'Baking',
  service: 'Condiments & service',
  ingredients: 'Ingredients',
  greenery: 'Greenery',
}

/** Ranked prop chips shown before the full list. */
export const PROP_SUGGESTION_LIMIT = 4

export interface StudioProp {
  id: string
  label: string
  description: string
  placement: string
  group: StudioPropGroup
  /** Which dishes may be offered this prop. `any` stays available for both. */
  audience: StudioPropAudience
}

export const STUDIO_PROPS: readonly StudioProp[] = [
  {
    id: 'folded-napkin',
    label: 'Folded napkin',
    group: 'service',
    audience: 'any',
    description:
      'One unused ivory linen napkin, folded into a plain flat rectangle about 12 cm by 8 cm, with a visible hem and a matte woven texture. No embroidery, monogram, napkin ring, or decorative fold.',
    placement:
      'Lay it on the existing tabletop beside the vessel, not underneath the vessel and not touching the food.',
  },
  {
    id: 'unfolded-napkin',
    label: 'Unfolded napkin',
    group: 'service',
    audience: 'any',
    description:
      'One unused ivory linen napkin, opened flat into a square about 40 cm on each side, with a soft wrinkle and a visible hem. No embroidery, monogram, or napkin ring.',
    placement:
      'Lay it flat on the existing tabletop beside the vessel, not underneath the vessel and not covering the food.',
  },
  {
    id: 'fork',
    label: 'Fork',
    group: 'cutlery',
    audience: 'savory',
    description:
      'One plain stainless-steel dinner fork with four straight tines and a smooth unadorned handle. No pattern, no gold colour, and no black handle.',
    placement:
      'Place it on the existing tabletop to the left of the vessel, tines pointing away from the near edge and the handle toward the near edge. Do not add a knife.',
  },
  {
    id: 'knife-and-fork',
    label: 'Knife and fork',
    group: 'cutlery',
    audience: 'savory',
    description:
      'One matching pair of plain stainless-steel cutlery: a dinner knife with a rounded tip and a smooth handle, and a four-tine dinner fork with a smooth handle. No pattern, no gold colour, and no black handles.',
    placement:
      'Place them as a setting on the existing tabletop, the fork to the left of the vessel and the knife to the right, handles toward the near edge.',
  },
  {
    id: 'chopsticks',
    label: 'Chopsticks',
    group: 'cutlery',
    audience: 'savory',
    description:
      'One matching pair of straight dark wooden chopsticks, with tapered tips and a simple matte finish. No decorative bands, wrappers, or logo.',
    placement:
      'Rest the pair together diagonally on the existing tabletop next to the bowl. Do not balance them across the food.',
  },
  {
    id: 'fine-grater',
    label: 'Fine grater',
    group: 'cutlery',
    audience: 'any',
    description:
      'One narrow handheld stainless-steel fine grater with a slim rectangular grating face and a plain dark handle. No grated material is flying through the air.',
    placement:
      'Set it flat on the existing tabletop near the vessel. It must not touch, cut, or alter the food.',
  },
  {
    id: 'ramekin-nuts',
    label: 'Ramekin of nuts',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One small round white ceramic ramekin, about 8 cm across, with a plain matte finish and no pattern or logo. It is filled level with whole cashews and whole almonds. No nuts outside the ramekin.',
    placement:
      'Set the ramekin on the existing tabletop beside the vessel, not on the plate and not on the food.',
  },
  {
    id: 'salt-shaker',
    label: 'Salt mill',
    group: 'service',
    audience: 'savory',
    description:
      'One small dark-walnut salt mill, about 14 cm tall, with a plain turned cylinder, a matte wood grain, and a small stainless grinding knob on top. No branding, no glass body, and no silver diner-shaker top.',
    placement: 'Stand it on the existing tabletop beside the vessel.',
  },
  {
    id: 'salt-and-pepper',
    label: 'Salt and pepper mills',
    group: 'service',
    audience: 'savory',
    description:
      'Two matching small dark-walnut mills, about 14 cm tall, each a plain turned cylinder with a matte wood grain and a small stainless grinding knob. One is a salt mill. The other is a pepper mill. No branding, no glass bodies, and no silver diner-shaker tops.',
    placement: 'Stand them together on the existing tabletop beside the vessel.',
  },
  {
    id: 'olive-oil-cruet',
    label: 'Olive oil cruet',
    group: 'service',
    audience: 'savory',
    description:
      'One small clear-glass olive oil cruet with a narrow neck and a simple cork stopper, partly filled with golden-green olive oil. No label and no pouring motion.',
    placement:
      'Stand it on the existing tabletop behind or beside the vessel, leaving the dish unobscured.',
  },
  {
    id: 'soy-sauce-dish',
    label: 'Soy sauce dish',
    group: 'service',
    audience: 'savory',
    description:
      'One very small shallow off-white ceramic dipping dish, about 7 cm across, containing a little dark soy sauce. Plain glaze, no logo, and no chopsticks.',
    placement:
      'Set the dish on the existing tabletop to one side of the main vessel, not on the food.',
  },
  {
    id: 'jam-jar',
    label: 'Small jam jar',
    group: 'baking',
    audience: 'cake',
    description:
      'One small clear-glass jam jar, roughly 8 cm tall, with deep red berry jam inside and a plain metal lid set on top. No label, text, or spoon.',
    placement:
      'Stand it on the existing tabletop to the side of the cake or pastry, not touching the food.',
  },
  {
    id: 'yellow-pepper',
    label: 'Yellow pepper',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One whole fresh yellow bell pepper, glossy, uncut, with a short green stem. Not sliced, not a chilli, and not orange or red.',
    placement:
      'Set it on the existing tabletop beside the vessel. Do not place it on the food and do not cut it.',
  },
  {
    id: 'parmesan-wedge',
    label: 'Parmesan wedge',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One small triangular wedge of hard aged Parmesan-style cheese, with a pale straw-coloured granular cut face and a natural darker rind. No grater and no loose shavings.',
    placement:
      'Rest it directly on the existing tabletop beside the main vessel. Do not put it on the food or add another plate or board.',
  },
  {
    id: 'whole-lemon',
    label: 'Whole lemon',
    group: 'ingredients',
    audience: 'any',
    description:
      'One small whole ripe yellow lemon with slightly textured natural skin and a short green stem. Intact, not sliced, with no leaves or lettering.',
    placement:
      'Place it directly on the existing tabletop to one side of the vessel, not on the food.',
  },
  {
    id: 'whole-lime',
    label: 'Whole lime',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One small whole fresh green lime with slightly dimpled glossy skin. Intact, not a lemon, not cut, and no leaves.',
    placement: 'Place it on the existing tabletop near, but not touching, the vessel.',
  },
  {
    id: 'cherry-tomato-vine',
    label: 'Cherry tomato vine',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One short natural vine bearing three or four ripe red cherry tomatoes and a few small green stems. No cut tomatoes.',
    placement:
      'Lay it on the existing tabletop near the vessel, without climbing onto the plate or food.',
  },
  {
    id: 'berry-bowl',
    label: 'Small bowl of berries',
    group: 'baking',
    audience: 'cake',
    description:
      'One small shallow off-white ceramic bowl, about 9 cm across, holding a restrained mix of fresh raspberries and blueberries. No cream, sauce, or berries outside the bowl.',
    placement:
      'Set it on the existing tabletop next to a cake or dessert, never on top of the main plate.',
  },
  {
    id: 'soup-spoon',
    label: 'Soup spoon',
    group: 'cutlery',
    audience: 'savory',
    description:
      'One polished stainless-steel soup spoon with a simple rounded bowl and an unadorned slender handle. No pattern, logo, or accompanying cutlery.',
    placement:
      'Lay it flat on the existing tabletop beside the vessel, with the bowl pointing towards the dish.',
  },
  {
    id: 'butter-knife',
    label: 'Butter knife',
    group: 'cutlery',
    audience: 'savory',
    description:
      'One short stainless-steel butter knife with a rounded, blunt tip and a simple polished handle. No other cutlery.',
    placement:
      'Lay it flat on the existing tabletop beside the vessel, with the blade turned inwards.',
  },
  {
    id: 'teaspoon',
    label: 'Teaspoon',
    group: 'cutlery',
    audience: 'cake',
    description:
      'One small polished stainless-steel teaspoon, about 13 cm long, with a plain oval bowl and a narrow handle. No logo or other utensils.',
    placement: 'Lay it neatly on the existing tabletop beside the vessel, not on the food.',
  },
  {
    id: 'dessert-fork',
    label: 'Dessert fork',
    group: 'cutlery',
    audience: 'cake',
    description:
      'One small polished stainless-steel dessert fork with four short tines and a plain narrow handle. No pattern or logo.',
    placement:
      'Lay it on the existing tabletop near the dessert vessel, without touching or obscuring the food.',
  },
  {
    id: 'cake-server',
    label: 'Cake server',
    group: 'cutlery',
    audience: 'cake',
    description:
      'One slim triangular stainless-steel cake server with a gently curved polished handle. No engraved pattern or logo.',
    placement:
      'Place it on the existing tabletop near the cake. Do not slide it under, cut, or lift the cake.',
  },
  {
    id: 'wooden-spoon',
    label: 'Small wooden spoon',
    group: 'baking',
    audience: 'cake',
    description:
      'One small light-beech wooden spoon with a shallow oval bowl and a smooth plain handle, about 16 cm long.',
    placement: 'Lay it flat on the existing tabletop beside the vessel, not inside the food.',
  },
  {
    id: 'mini-whisk',
    label: 'Mini whisk',
    group: 'baking',
    audience: 'cake',
    description:
      'One compact stainless-steel balloon whisk, about 18 cm long, with a slender metal handle and clean wire loops. No bowl attached.',
    placement: 'Lay it on the existing tabletop near a baked item, clear of the food and vessel.',
  },
  {
    id: 'flour-bag',
    label: 'Bag of flour',
    group: 'baking',
    audience: 'cake',
    description:
      'One small plain brown paper bag of white flour, about 12 cm tall, folded closed at the top, with a light dusting of flour on the paper. No printed brand, no logo, and no spilled pile.',
    placement:
      'Stand it on the existing tabletop beside the bake, not on the food and not in front of the vessel.',
  },
  {
    id: 'chocolate-bar',
    label: 'Chocolate squares',
    group: 'baking',
    audience: 'cake',
    description:
      'One small dark chocolate bar snapped into a short row of four squares still partly attached, with a matte cocoa surface. No wrapper, foil, or brand name.',
    placement:
      'Rest it on the existing tabletop beside the dessert, not on the cake.',
  },
  {
    id: 'cocoa-tin',
    label: 'Cocoa tin',
    group: 'baking',
    audience: 'cake',
    description:
      'One small unmarked metal tin of cocoa powder, about 8 cm tall, with a plain lid and a matte dark-brown finish. No label, no spoon, and no loose powder.',
    placement: 'Stand it on the existing tabletop beside the bake, not on the food.',
  },
  {
    id: 'honey-pot',
    label: 'Small honey pot',
    group: 'baking',
    audience: 'cake',
    description:
      'One small round clear-glass pot containing amber honey, with a plain closed lid. No printed label, honey dipper, or spills.',
    placement: 'Set it on the existing tabletop near the baked item, away from the main presentation area.',
  },
  {
    id: 'cinnamon-sticks',
    label: 'Cinnamon sticks',
    group: 'baking',
    audience: 'cake',
    description:
      'Two small natural cinnamon quills, warm brown with tightly curled bark. No powder, star anise, or ribbon.',
    placement: 'Place the pair close together on the existing tabletop beside a dessert.',
  },
  {
    id: 'vanilla-pods',
    label: 'Vanilla pods',
    group: 'baking',
    audience: 'cake',
    description:
      'Two slender dark-brown whole vanilla pods with slightly wrinkled skins, uncut and without loose seeds.',
    placement: 'Lay them side by side on the existing tabletop near a cake or dessert.',
  },
  {
    id: 'butter-dish',
    label: 'Small butter dish',
    group: 'service',
    audience: 'any',
    description:
      'One tiny ivory ceramic butter dish holding a single neat curl of pale yellow butter. The dish has a low rim and no lid or logo.',
    placement: 'Place it on the existing tabletop beside the vessel, not on the plate.',
  },
  {
    id: 'tomato-sauce-ramekin',
    label: 'Tomato sauce ramekin',
    group: 'service',
    audience: 'savory',
    description:
      'One small plain white ceramic ramekin, about 7 cm across, holding a modest amount of thick red tomato sauce. No spoon, splashes, or overflow.',
    placement: 'Set the ramekin on the existing tabletop next to the main dish, never on the main plate.',
  },
  {
    id: 'chilli-oil-dish',
    label: 'Chilli oil dish',
    group: 'service',
    audience: 'savory',
    description:
      'One tiny low-rimmed stoneware dish containing a small pool of translucent red chilli oil with a few visible chilli flakes. No drips outside the dish.',
    placement: 'Place it on the existing tabletop beside the vessel, secondary to the main food.',
  },
  {
    id: 'garlic-bulb',
    label: 'Garlic bulb',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One whole small garlic bulb with intact ivory papery skin and a short dry stem. No detached cloves and no peeled garlic.',
    placement: 'Rest it on the existing tabletop to one side of the vessel, away from the main food.',
  },
  {
    id: 'kimchi-bowl',
    label: 'Small bowl of kimchi',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One tiny shallow grey ceramic bowl containing a modest serving of red-orange napa cabbage kimchi. No chopsticks, broth, or spillover.',
    placement: 'Place the bowl on the existing tabletop beside the main vessel, clearly smaller than the dish.',
  },
  {
    id: 'pickle-bowl',
    label: 'Small bowl of pickles',
    group: 'ingredients',
    audience: 'savory',
    description:
      'One tiny unpatterned ceramic bowl containing a few thin green cucumber pickles in a small amount of clear brine. No fork or spilled liquid.',
    placement: 'Set it on the existing tabletop alongside the meal, apart from the main vessel.',
  },
  {
    id: 'trailing-vine',
    label: 'Trailing vine',
    group: 'greenery',
    audience: 'any',
    description:
      'A few slender trailing stems of a glossy green vine with heart-shaped leaves, cut off by the top of the frame. No pot, hanger, ceiling, hook, or wall is visible. Not a full houseplant and not leaves scattered on the food.',
    placement:
      'Let the vine enter from the top edge of the existing frame, behind the dish and farther from the camera. Only part of the vine is visible. Keep it secondary and slightly softer in focus. It does not rest on the table. Do not cover the food, widen the frame, add a ceiling or hanger, or replace the backdrop.',
  },
  {
    id: 'dried-grasses',
    label: 'Dried grasses',
    group: 'greenery',
    audience: 'any',
    description:
      'One small bunch of pale beige dried stems topped with soft oval seed heads, about 25 cm tall, in a small matte cream ceramic vase with a narrow neck and no pattern. Not wheat, not fresh flowers, not a ribbon, and not a candle.',
    placement:
      'Set it on the existing tabletop behind the vessel, farther from the camera than the dish. Keep it secondary and slightly softer in focus. Do not cover the food, widen the frame, or replace the backdrop.',
  },
  {
    id: 'potted-basil',
    label: 'Potted basil',
    group: 'greenery',
    audience: 'savory',
    description:
      'One living sweet basil plant with dense bright-green leaves, about 16 cm tall including the pot. The pot is a small unlabelled matte stoneware cylinder with no saucer. This is a whole plant, not loose basil leaves and not a cut sprig on the food.',
    placement:
      'Set it on the existing tabletop behind the vessel, farther from the camera than the dish. Keep it secondary and slightly softer in focus. Do not cover the food, widen the frame, or replace the backdrop.',
  },
  {
    id: 'leafy-stems',
    label: 'Leafy stems',
    group: 'greenery',
    audience: 'any',
    description:
      'A few slender woody stems with small oval green leaves, about 22 cm tall, standing in a short clear glass cylinder of water. No flowers, no ribbon, and no second vase.',
    placement:
      'Set it on the existing tabletop behind the vessel, farther from the camera than the dish. Keep it secondary and slightly softer in focus. Do not cover the food, widen the frame, or replace the backdrop.',
  },
  {
    id: 'cow-parsley',
    label: 'Cow parsley',
    group: 'greenery',
    audience: 'any',
    description:
      'A few wiry stems of tiny white flowers in loose flat clusters, about 28 cm tall, in a small matte off-white bottle. Airy and sparse. Not a dense florist bouquet, not roses, and not mixed greenery.',
    placement:
      'Set it on the existing tabletop behind the vessel, farther from the camera than the dish. Keep it secondary and slightly softer in focus. Do not cover the food, widen the frame, or replace the backdrop.',
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

export function propMatchesAudience(
  prop: StudioProp,
  audience: FinishingTouchFamily,
): boolean {
  return prop.audience === 'any' || prop.audience === audience
}

export function propsForAudience(audience: FinishingTouchFamily): StudioProp[] {
  return STUDIO_PROPS.filter((prop) => propMatchesAudience(prop, audience))
}

export function sanitizeRecommendedPropIds(
  rawIds: unknown,
  audience: FinishingTouchFamily = 'savory',
): StudioProp[] {
  const ids = Array.isArray(rawIds)
    ? rawIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
    : []
  return propsFromIds(ids)
    .filter((prop) => propMatchesAudience(prop, audience))
    .slice(0, PROP_SUGGESTION_LIMIT)
}

export function propIdListForPrompt(): string {
  return STUDIO_PROPS.map((prop) => `${prop.id} (${prop.label}, ${prop.audience})`).join(', ')
}

export type HeroSceneRow = readonly [label: string, value: string]

export type HeroDemoImages = {
  og: string
  slider: string
}

export type HeroDemoDish = {
  file: string
  scene: HeroSceneRow[]
  images: HeroDemoImages
  /** Finished placement, shown on the publish step. */
  settingSrc: string
  settingAlt: string
  dish: string
}

const ACAI = '/marketing/hero-compare/acai'
const PASTRAMI = '/marketing/hero-compare/pastrami-sandwich'
const CHICKEN = '/marketing/hero-compare/chicken-thighs'
const PIZZA = '/marketing/hero-compare/pizza'
const TART = '/marketing/hero-compare/chocolate tart'

/**
 * Açaí, pastrami, chicken thighs, pizza, then the chocolate tart.
 * Scene rows use the Studio's real control names, matched to the enhanced photo.
 * The publish step shows the supplied placement image for that dish.
 */
export const HERO_DEMO_DISHES: HeroDemoDish[] = [
  {
    file: 'acai-bowl.png',
    scene: [
      ['ELEMENTS', 'Fruit, nuts & honey'],
      ['PROPS', 'Napkin, spoon & stems'],
      ['SURFACE', 'Raw Concrete'],
      ['LIGHTING', 'Bright & Clean'],
    ],
    images: {
      og: `${ACAI}/acai-bowl-OG.png`,
      slider: `${ACAI}/acai-bowl-enhanced.jpg`,
    },
    settingSrc: `${ACAI}/acai-delivery-app.png`,
    settingAlt: 'Signature Berry Açaí shown in a delivery app',
    dish: 'Signature Berry Açaí',
  },
  {
    file: 'pastrami-sandwich.jpg',
    scene: [
      ['VESSEL', 'Square white plate'],
      ['ELEMENTS', 'Pickled onion'],
      ['BACKDROP', 'Terracotta'],
      ['LIGHTING', 'Dark & Moody'],
    ],
    images: {
      og: `${PASTRAMI}/pastrami-sandwich-OG.jpg`,
      slider: `${PASTRAMI}/pastrami-sandwich-enhanced.jpg`,
    },
    settingSrc: `${PASTRAMI}/pastrami-sandwich-screen-menu.png`,
    settingAlt: 'Hot Pastrami on Rye shown on a deli menu board',
    dish: 'Hot Pastrami on Rye',
  },
  {
    file: 'chicken-thighs.jpg',
    scene: [
      ['VESSEL', 'Brown rim plate'],
      ['PROPS', 'Napkin, oil & mills'],
      ['SURFACE', 'Natural Linen'],
      ['CAMERA', 'Overhead'],
    ],
    images: {
      og: `${CHICKEN}/chicken-thighs-OG.jpg`,
      slider: `${CHICKEN}/chicken-thighs-enhanced.jpg`,
    },
    settingSrc: `${CHICKEN}/chicken-thighs-social-media.png`,
    settingAlt: 'Chicken thighs with orzo shown in a social post',
    dish: 'Chicken Thighs',
  },
  {
    file: 'pizza.jpg',
    scene: [
      ['VESSEL', 'Wooden board'],
      ['PROPS', 'Basil, oil & tomatoes'],
      ['SURFACE', 'White Marble'],
      ['CAMERA', 'Overhead'],
    ],
    images: {
      og: `${PIZZA}/pizza-OG.jpg`,
      slider: `${PIZZA}/pizz-enhanced.jpg`,
    },
    settingSrc: `${PIZZA}/pizza-website.png`,
    settingAlt: 'Wood-fired pizza shown on a restaurant website',
    dish: 'Wood-Fired Pizza',
  },
  {
    file: 'chocolate-tart.webp',
    scene: [
      ['VESSEL', 'Slate'],
      ['ELEMENTS', 'Shavings & mint'],
      ['BACKDROP', 'Sage Green'],
      ['LIGHTING', 'Soft Natural'],
    ],
    images: {
      og: `${TART}/chocolate-tart-OG.webp`,
      slider: `${TART}/chocolate-tart-enhanced.jpg`,
    },
    settingSrc: `${TART}/chocolate-tart-magazine.png`,
    settingAlt: 'Chocolate tart shown in a magazine feature',
    dish: 'Chocolate Tart',
  },
]

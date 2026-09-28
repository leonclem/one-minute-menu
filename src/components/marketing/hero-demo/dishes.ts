export type HeroSceneRow = readonly [label: string, value: string]

export type HeroDemoImages = {
  og: string
  slider: string
  insta: string
  blog: string
  book: string
  delivery: string
}

export type HeroDemoDish = {
  file: string
  scene: HeroSceneRow[]
  images: HeroDemoImages
  initial: string
  handle: string
  likes: string
  comments: string
  caption: string
  url: string
  blog: string
  category: string
  recipe: string
  meta: string
  chapter: string
  bookTitle: string
  page: string
  ingredients: string[]
  dish: string
  desc: string
  price: string
}

const MASSAMAN = '/marketing/hero-compare/massaman-curry'
const BANANA = '/marketing/hero-compare/banana-bread'

/**
 * Two-dish loop. Banana bread leads, then massaman.
 * Banana bread uses the four-control scene and the full-size photos already on
 * the site. Massaman keeps the three-control overhead scene.
 * Labels are the Studio's real option names, matched to the photo on the slider.
 */
export const HERO_DEMO_DISHES: HeroDemoDish[] = [
  {
    file: 'banana-bread.jpg',
    scene: [
      ['LIGHTING', 'Golden Hour'],
      ['BACKDROP', 'Hot Pink'],
      ['SURFACE', 'Raw Concrete'],
      ['CAMERA ANGLE', 'Angled'],
    ],
    images: {
      og: `${BANANA}/OG.png`,
      slider: `${BANANA}/hot.png`,
      insta: `${BANANA}/rotated.png`,
      blog: `${BANANA}/hot.png`,
      book: `${BANANA}/overhead.png`,
      delivery: `${BANANA}/rotated.png`,
    },
    initial: 'B',
    handle: 'sundayloaf',
    likes: '3,912',
    comments: '142',
    caption: 'Midweek bake, weekend energy. Brown sugar glaze and pistachios.',
    url: 'theweeknighttable.com/banana-bread',
    blog: 'The Weeknight Table',
    category: 'BAKING · WEEKEND',
    recipe: 'Pistachio Banana Bread',
    meta: '1 hr 10 · Serves 8 · Easy',
    chapter: 'CHAPTER NINE · SWEET',
    bookTitle: 'Banana Bread',
    page: '212',
    ingredients: [
      '3 ripe bananas',
      '120g unsalted butter',
      '2 free-range eggs',
      '150g light brown sugar',
      'Handful of pistachios',
    ],
    dish: 'Banana Bread',
    desc: 'Brown sugar glaze, pistachio crumb and a thick slice of banana loaf.',
    price: '£6.80',
  },
  {
    file: 'massaman-curry.jpg',
    scene: [
      ['LIGHTING', 'Soft Natural'],
      ['SURFACE', 'Dark Stone'],
      ['CAMERA ANGLE', 'Overhead'],
    ],
    images: {
      og: `${MASSAMAN}/OG.jpg`,
      slider: `${MASSAMAN}/slate.jpg`,
      insta: `${MASSAMAN}/moody.jpg`,
      blog: `${MASSAMAN}/slate.jpg`,
      book: `${MASSAMAN}/fresh.jpg`,
      delivery: `${MASSAMAN}/moody.jpg`,
    },
    initial: 'S',
    handle: 'saffronandco',
    likes: '2,481',
    comments: '86',
    caption: 'Sunday sorted. Our Massaman paste, 45 minutes, zero effort.',
    url: 'theweeknighttable.com/massaman-curry',
    blog: 'The Weeknight Table',
    category: 'CURRIES · DINNER',
    recipe: 'Slow-Cooked Massaman Curry',
    meta: '45 min · Serves 4 · Easy',
    chapter: 'CHAPTER THREE · COMFORT',
    bookTitle: 'Massaman Curry',
    page: '87',
    ingredients: [
      '400g chicken thighs',
      '2 tbsp Massaman paste',
      '400ml coconut milk',
      '2 waxy potatoes, cubed',
      'Handful of roasted peanuts',
    ],
    dish: 'Massaman Curry',
    desc: 'Slow-cooked chicken, potato and roasted peanuts with jasmine rice.',
    price: '£12.50',
  },
]

export const HERO_DEMO_SCENARIOS = [
  { key: 'insta', label: 'Instagram', fmt: '4:5' },
  { key: 'blog', label: 'Recipe blog', fmt: '16:9' },
  { key: 'book', label: 'Cookbook', fmt: 'Print' },
  { key: 'delivery', label: 'Delivery app', fmt: '1:1' },
] as const

export type HeroScenarioKey = (typeof HERO_DEMO_SCENARIOS)[number]['key']

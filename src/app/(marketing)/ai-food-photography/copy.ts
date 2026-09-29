export const AI_FOOD_PHOTOGRAPHY_PATH = '/ai-food-photography'

export const AI_FOOD_PHOTOGRAPHY_CANONICAL =
  'https://www.gridmenu.ai/ai-food-photography'

export const AI_FOOD_PHOTOGRAPHY_TITLE =
  'AI Food Photography | Turn Real Food Photos Into Studio-Quality Images | GridMenu'

export const AI_FOOD_PHOTOGRAPHY_DESCRIPTION =
  'Turn real food photos into studio-quality images with AI. Adjust lighting, backgrounds, surfaces and styling without prompt engineering.'

export const AI_FOOD_PHOTOGRAPHY_H1 =
  'AI Food Photography Using Your Real Food Photos'

export const AI_FOOD_PHOTOGRAPHY_FAQS: Array<{ question: string; answer: string }> = [
  {
    question: 'What is AI food photography?',
    answer:
      'AI food photography uses artificial intelligence to create or improve food imagery. GridMenu focuses on editing real food photos rather than generating an entirely new dish from a text prompt.',
  },
  {
    question: 'Does GridMenu generate fake food?',
    answer:
      'GridMenu starts with an image you upload and is designed to preserve the identity of the real dish while changing elements such as lighting, background, surface and styling. AI generation can still introduce variation, so review the result before you publish it.',
  },
  {
    question: 'Do I need to write prompts?',
    answer: 'No. GridMenu is designed around visual controls rather than prompt engineering.',
  },
  {
    question: 'What kind of photos can I upload?',
    answer:
      'Food photos taken on a phone or camera can be used, including existing brand assets. A clearer source photo generally gives the edit more useful visual information.',
  },
  {
    question: 'Can I use GridMenu for restaurant menus?',
    answer:
      'Yes. GridMenu can create polished food imagery suitable for restaurant menus, delivery platforms, websites and social media.',
  },
  {
    question: 'Can food brands use GridMenu?',
    answer:
      'Yes. Food brands can use existing product and recipe imagery to create alternative campaign treatments and content variations.',
  },
  {
    question: 'Is GridMenu a replacement for professional food photographers?',
    answer:
      'GridMenu is an additional tool for food-image production. It can help businesses and creators improve existing imagery, create variations and reduce the need for repeated setup work. Professional photography remains valuable where full creative direction, styling and production are required.',
  },
  {
    question: 'Can I use the same food photo to create multiple versions?',
    answer:
      'Yes. Start with one real food image and create different visual treatments for different channels or campaigns.',
  },
]

export const COMPARISON_ROWS: Array<{ generic: string; gridmenu: string }> = [
  { generic: 'Starts from a prompt', gridmenu: 'Starts from your real food photo' },
  { generic: 'Can invent or change the dish', gridmenu: 'Designed to preserve the dish' },
  { generic: 'Requires prompt iteration', gridmenu: 'Uses simple visual controls' },
  { generic: 'Results can change unpredictably', gridmenu: 'Built for controlled editing' },
  { generic: 'Creates a new image concept', gridmenu: 'Improves the presentation of your existing image' },
]

export const USE_CASES: Array<{ title: string; body: string }> = [
  {
    title: 'Restaurants and ghost kitchens',
    body: 'Improve menu and delivery-platform images without organising a full photoshoot for every update.',
  },
  {
    title: 'Food brands',
    body: 'Create campaign-ready variations from existing product and recipe photography.',
  },
  {
    title: 'Designers',
    body: 'Turn inconsistent client-supplied food photos into cleaner assets for menus, websites and campaigns.',
  },
  {
    title: 'Social media marketers',
    body: 'Create multiple visual treatments from a single real food photo.',
  },
  {
    title: 'Food photographers',
    body: 'Use AI as an extension of the photography workflow for controlled variations and post-production.',
  },
  {
    title: 'Content creators',
    body: 'Create more polished food imagery while keeping your original dish recognisable.',
  },
]

export const OUTPUT_FORMATS: Array<{ label: string; detail: string }> = [
  { label: 'Delivery square', detail: '1:1 thumbnails for delivery apps and menu cards' },
  { label: 'Delivery landscape', detail: '16:9 slots and marketplace banners' },
  { label: 'Instagram feed', detail: '4:5 portrait posts' },
  { label: 'Menu tile', detail: 'Square assets for menus and dish grids' },
  { label: 'Transparent cut-out', detail: 'PNG dish assets for layouts and ads' },
]

const MASSAMAN = '/marketing/hero-compare/massaman-curry'
const BANANA = '/marketing/hero-compare/banana-bread'

export const BEFORE_AFTER_EXAMPLES: Array<{
  caption: string
  beforeSrc: string
  beforeAlt: string
  afterSrc: string
  afterAlt: string
}> = [
  {
    caption: 'Same dish. New lighting and surface.',
    beforeSrc: `${MASSAMAN}/OG.jpg`,
    beforeAlt: 'Original photo of massaman curry in a bowl, with flat lighting on a plain table',
    afterSrc: `${MASSAMAN}/slate.jpg`,
    afterAlt: 'The same massaman curry on a dark stone surface with softer lighting',
  },
  {
    caption: 'Original food preserved. Brighter presentation.',
    beforeSrc: `${MASSAMAN}/OG.jpg`,
    beforeAlt: 'Original photo of massaman curry before a brighter treatment',
    afterSrc: `${MASSAMAN}/fresh.jpg`,
    afterAlt: 'The same massaman curry with a brighter, fresher presentation',
  },
  {
    caption: 'Same curry. A darker, campaign-ready treatment.',
    beforeSrc: `${MASSAMAN}/OG.jpg`,
    beforeAlt: 'Original photo of massaman curry before a darker backdrop treatment',
    afterSrc: `${MASSAMAN}/moody.jpg`,
    afterAlt: 'The same massaman curry with a darker backdrop for campaign use',
  },
  {
    caption: 'Same loaf. New lighting and backdrop.',
    beforeSrc: `${BANANA}/OG.png`,
    beforeAlt: 'Original photo of a slice of banana bread on a plain surface',
    afterSrc: `${BANANA}/hot.png`,
    afterAlt: 'The same banana bread with golden-hour lighting and a hot pink backdrop',
  },
  {
    caption: 'Same bake. Overhead angle for a menu or cookbook.',
    beforeSrc: `${BANANA}/OG.png`,
    beforeAlt: 'Original angled photo of banana bread',
    afterSrc: `${BANANA}/overhead.png`,
    afterAlt: 'The same banana bread photographed from overhead',
  },
  {
    caption: 'Same loaf. A tighter crop for social and delivery.',
    beforeSrc: `${BANANA}/OG.png`,
    beforeAlt: 'Original photo of banana bread before a tighter crop',
    afterSrc: `${BANANA}/rotated.png`,
    afterAlt: 'The same banana bread in a tighter, rotated crop',
  },
]

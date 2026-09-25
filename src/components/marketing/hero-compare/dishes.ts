export type HeroCompareFit = 'cover' | 'contain'

export type HeroCompareVariant = {
  label: string
  src: string
}

/**
 * One homepage compare dish. Append an entry to add a dish later.
 * Variant order is the order the carousel steps through. Labels are per dish.
 *
 * `cover` fills the square frame. Wide photos are centered and cropped on the sides.
 * `contain` keeps the whole photo visible, with a blurred copy filling the rest.
 */
export type HeroCompareDish = {
  name: string
  originalSrc: string
  fit: HeroCompareFit
  variants: HeroCompareVariant[]
}

export const HERO_COMPARE_DISHES: HeroCompareDish[] = [
  {
    name: 'Massaman Curry',
    originalSrc: '/marketing/hero-compare/massaman-curry/OG.jpg',
    fit: 'cover',
    variants: [
      { label: 'Slate', src: '/marketing/hero-compare/massaman-curry/slate.jpg' },
      { label: 'Fresh', src: '/marketing/hero-compare/massaman-curry/fresh.jpg' },
      { label: 'Moody', src: '/marketing/hero-compare/massaman-curry/moody.jpg' },
    ],
  },
  {
    name: 'Banana Bread',
    originalSrc: '/marketing/hero-compare/banana-bread/OG.png',
    fit: 'cover',
    variants: [
      { label: 'Hot', src: '/marketing/hero-compare/banana-bread/hot.png' },
      { label: 'Rotated', src: '/marketing/hero-compare/banana-bread/rotated.png' },
      { label: 'Overhead', src: '/marketing/hero-compare/banana-bread/overhead.png' },
    ],
  },
]

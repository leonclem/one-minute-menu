/**
 * V2 palette source of truth.
 *
 * Keep explicit admin-editable colour hexes here, including promoted/feature
 * tile chrome, so renderer modules do not synthesize colours programmatically.
 */

export interface PromotedItemColorsV2 {
  background: string
  border: string
  badgeFill: string
  badgeText: string
}

export interface FlagshipPromotedColorsV2 extends PromotedItemColorsV2 {
  price: string
}

export interface InverseTileColorsV2 {
  background: string
  text: string
  border: string
}

export interface ColorPaletteV2 {
  id: string
  name: string
  colors: {
    background: string
    surface?: string
    menuTitle: string
    sectionHeader: string
    itemTitle: string
    itemPrice: string
    accent?: string
    itemDescription: string
    itemIndicators: {
      background: string
    }
    border: {
      light: string
      medium: string
    }
    textMuted: string
    bannerSurface: string
    bannerText: string
    footerBorder: string
    footerText: string
    inverseTiles?: {
      logoTitle: InverseTileColorsV2
      sectionHeader: InverseTileColorsV2
    }
    promoted: {
      featured: PromotedItemColorsV2
      flagship: FlagshipPromotedColorsV2
    }
  }
}

export const COLOR_TOKENS_V2 = {
  text: {
    primary: '#111827',
    secondary: '#6B7280',
    muted: '#9CA3AF'
  },
  background: {
    white: '#FFFFFF',
    gray50: '#F9FAFB',
    gray100: '#F3F4F6'
  },
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB'
  },
  indicator: {
    vegetarian: '#10B981',
    vegan: '#059669',
    halal: '#3B82F6',
    kosher: '#6366F1',
    glutenFree: '#F59E0B',
    spice: '#EF4444'
  }
} as const

export const PALETTES_V2: ColorPaletteV2[] = [
  {
    id: 'clean-modern',
    name: 'Clean Modern',
    colors: {
      background: '#FFFFFF',
      surface: '#F9FAFB',
      menuTitle: '#111827',
      sectionHeader: '#111827',
      itemTitle: '#111827',
      itemPrice: '#111827',
      itemDescription: '#6B7280',
      itemIndicators: { background: '#FFFFFF' },
      border: { light: '#E5E7EB', medium: '#D1D5DB' },
      textMuted: '#9CA3AF',
      bannerSurface: '#E1E3E8',
      bannerText: '#111827',
      footerBorder: '#E5E7EB',
      footerText: '#111827',
      inverseTiles: {
        logoTitle: { background: '#111827', text: '#FFFFFF', border: '#111827' },
        sectionHeader: { background: '#E5E7EB', text: '#111827', border: '#D1D5DB' },
      },
      promoted: {
        featured: { background: '#E4E6E8', border: '#111827', badgeFill: '#111827', badgeText: '#FFFFFF' },
        flagship: { background: '#D6D5D2', border: '#382F17', badgeFill: '#382E13', badgeText: '#FFF9E8', price: '#202121' }
      }
    }
  },
  {
    id: 'elegant-cream',
    name: 'Elegant Cream',
    colors: {
      background: '#FDFCF0',
      surface: '#F5F2E8',
      menuTitle: '#2C2C2C',
      sectionHeader: '#634e06',
      itemTitle: '#2C2C2C',
      itemPrice: '#8B6B23',
      itemDescription: '#555555',
      itemIndicators: { background: '#FDFCF0' },
      border: { light: '#E8E4C9', medium: '#D4CFA3' },
      textMuted: '#8E8E8E',
      bannerSurface: '#D4CFC1',
      bannerText: '#2C2C2C',
      footerBorder: '#E8E4C9',
      footerText: '#2C2C2C',
      inverseTiles: {
        logoTitle: { background: '#8B6B23', text: '#FDFCF0', border: '#6E5317' },
        sectionHeader: { background: '#E9DFC4', text: '#634e06', border: '#D4CFA3' },
      },
      promoted: {
        featured: { background: '#EBE6D6', border: '#8B6B23', badgeFill: '#8B6B23', badgeText: '#FFFFFF' },
        flagship: { background: '#E0D8C2', border: '#7F5F14', badgeFill: '#745711', badgeText: '#FFF9E8', price: '#86661D' }
      }
    }
  },
  {
    id: 'midnight-gold',
    name: 'Midnight Gold',
    colors: {
      background: '#1A1A1A',
      surface: '#252525',
      menuTitle: '#D4AF37',
      sectionHeader: '#D4AF37',
      itemTitle: '#FFFFFF',
      itemPrice: '#D4AF37',
      itemDescription: '#A0A0A0',
      itemIndicators: { background: '#1A1A1A' },
      border: { light: '#333333', medium: '#444444' },
      textMuted: '#666666',
      bannerSurface: '#8f7e02',
      bannerText: '#1C1C1B',
      footerBorder: '#333333',
      footerText: '#1C1C1B',
      inverseTiles: {
        logoTitle: { background: '#D4AF37', text: '#1A1A1A', border: '#F0D27A' },
        sectionHeader: { background: '#3A321B', text: '#F0D27A', border: '#7B6521' },
      },
      promoted: {
        featured: { background: '#353127', border: '#D4AF37', badgeFill: '#D4AF37', badgeText: '#FFFFFF' },
        flagship: { background: '#3D3624', border: '#AA8620', badgeFill: '#98771B', badgeText: '#FFF9E8', price: '#C49F2E' }
      }
    }
  },
  {
    id: 'warm-earth',
    name: 'Warm Earth',
    colors: {
      background: '#F5F0E8',
      surface: '#EDE6DC',
      menuTitle: '#3E2C1C',
      sectionHeader: '#3E2C1C',
      itemTitle: '#3E2C1C',
      itemPrice: '#8B6914',
      itemDescription: '#6B5B4E',
      itemIndicators: { background: '#F5F0E8' },
      border: { light: '#E0D5C4', medium: '#C9BAA3' },
      textMuted: '#9A8B7A',
      bannerSurface: '#d3c5b2',
      bannerText: '#3E2C1C',
      footerBorder: '#E0D5C4',
      footerText: '#3E2C1C',
      inverseTiles: {
        logoTitle: { background: '#8B6914', text: '#FBF5EA', border: '#6D5210' },
        sectionHeader: { background: '#E4D7B9', text: '#5D4210', border: '#C9BAA3' },
      },
      promoted: {
        featured: { background: '#E4DBCA', border: '#8B6914', badgeFill: '#8B6914', badgeText: '#FFFFFF' },
        flagship: { background: '#D9CEB7', border: '#7F5E0C', badgeFill: '#74560A', badgeText: '#FFF9E8', price: '#866511' }
      }
    }
  },
  {
    id: 'ocean-breeze',
    name: 'Ocean Breeze',
    colors: {
      background: '#F0F5F8',
      surface: '#E8EEF2',
      menuTitle: '#1B3A4B',
      sectionHeader: '#1B3A4B',
      itemTitle: '#1B3A4B',
      itemPrice: '#2E6B8A',
      itemDescription: '#5A7A8A',
      itemIndicators: { background: '#F0F5F8' },
      border: { light: '#D0DEE6', medium: '#B3C8D4' },
      textMuted: '#8A9FAB',
      bannerSurface: '#c9dbe6',
      bannerText: '#1B3A4B',
      footerBorder: '#D0DEE6',
      footerText: '#1B3A4B',
      inverseTiles: {
        logoTitle: { background: '#2E6B8A', text: '#F4FAFD', border: '#1F536D' },
        sectionHeader: { background: '#D9E8F0', text: '#1B3A4B', border: '#B3C8D4' },
      },
      promoted: {
        featured: { background: '#D7E2E9', border: '#2E6B8A', badgeFill: '#2E6B8A', badgeText: '#FFFFFF' },
        flagship: { background: '#D7E2E9', border: '#2E6B8A', badgeFill: '#2E6B8A', badgeText: '#FFFFFF', price: '#386674' }
      }
    }
  },
  {
    id: 'forest-green',
    name: 'Forest Green',
    colors: {
      background: '#F2F5F0',
      surface: '#E8EDE5',
      menuTitle: '#1C3318',
      sectionHeader: '#1C3318',
      itemTitle: '#1C3318',
      itemPrice: '#2D5A27',
      itemDescription: '#4E6B4A',
      itemIndicators: { background: '#F2F5F0' },
      border: { light: '#D4DED0', medium: '#B8C9B3' },
      textMuted: '#7E9478',
      bannerSurface: '#d1dfc5',
      bannerText: '#1C3318',
      footerBorder: '#D4DED0',
      footerText: '#1C3318',
      inverseTiles: {
        logoTitle: { background: '#2D5A27', text: '#F7FBF5', border: '#21461C' },
        sectionHeader: { background: '#D8E4D2', text: '#1C3318', border: '#B8C9B3' },
      },
      promoted: {
        featured: { background: '#D7E0D4', border: '#2D5A27', badgeFill: '#2D5A27', badgeText: '#FFFFFF' },
        flagship: { background: '#D7E0D4', border: '#2D5A27', badgeFill: '#2D5A27', badgeText: '#FFFFFF', price: '#385821' }
      }
    }
  },
  {
    id: 'valentines-rose',
    name: 'Blush Rose',
    colors: {
      background: '#FFF0F3',
      surface: '#FCE4E9',
      menuTitle: '#8B1A4A',
      sectionHeader: '#8B1A4A',
      itemTitle: '#4A0E2B',
      itemPrice: '#C2185B',
      itemDescription: '#7A5060',
      itemIndicators: { background: '#FFF0F3' },
      border: { light: '#F5D0DA', medium: '#E8A8BA' },
      textMuted: '#B08090',
      bannerSurface: '#f0cbd5',
      bannerText: '#8B1A4A',
      footerBorder: '#F5D0DA',
      footerText: '#8B1A4A',
      inverseTiles: {
        logoTitle: { background: '#9A1F57', text: '#FFF5F7', border: '#7E1847' },
        sectionHeader: { background: '#F3BCD0', text: '#7E1847', border: '#D97AA0' },
      },
      promoted: {
        featured: { background: '#F7D2DC', border: '#C2185B', badgeFill: '#C2185B', badgeText: '#FFFFFF' },
        flagship: { background: '#EBC3C9', border: '#9F2F35', badgeFill: '#8F2E2D', badgeText: '#FFF9E8', price: '#B5214D' }
      }
    }
  },
  {
    id: 'lunar-red-gold',
    name: 'Lunar Red & Gold',
    colors: {
      background: '#2B0A0A',
      surface: '#3d1515',
      menuTitle: '#D4A017',
      sectionHeader: '#D4A017',
      itemTitle: '#caa9a9',
      itemPrice: '#D4A017',
      itemDescription: '#C4A882',
      itemIndicators: { background: '#2B0A0A' },
      border: { light: '#5C1A1A', medium: '#7A2E2E' },
      textMuted: '#8A6A5A',
      bannerSurface: '#6d0505',
      bannerText: '#D4A017',
      footerBorder: '#5C1A1A',
      footerText: '#D4A017',
      inverseTiles: {
        logoTitle: { background: '#7B1010', text: '#F7E1A2', border: '#D4A017' },
        sectionHeader: { background: '#4D1717', text: '#F0C85A', border: '#A57810' },
      },
      promoted: {
        featured: { background: '#4B2215', border: '#D4A017', badgeFill: '#D4A017', badgeText: '#FFFFFF' },
        flagship: { background: '#512814', border: '#AA7E0D', badgeFill: '#98710B', badgeText: '#FFF9E8', price: '#C49313' }
      }
    }
  },
  {
    id: 'sunny-market',
    name: 'Sunny Market',
    colors: {
      background: '#F8BC02',
      surface: '#F5B200',
      menuTitle: '#1A1200',
      sectionHeader: '#1A1200',
      itemTitle: '#1A1200',
      itemPrice: '#5C3D00',
      itemDescription: '#4A3800',
      itemIndicators: { background: '#F8BC02' },
      border: { light: '#E5A800', medium: '#C98F00' },
      textMuted: '#7A5C00',
      bannerSurface: '#dca308',
      bannerText: '#1A1200',
      footerBorder: '#E5A800',
      footerText: '#1A1200',
      inverseTiles: {
        logoTitle: { background: '#5C3D00', text: '#FFF6D7', border: '#3F2A00' },
        sectionHeader: { background: '#FFD86A', text: '#5C3D00', border: '#C98F00' },
      },
      promoted: {
        featured: { background: '#E7A700', border: '#5C3D00', badgeFill: '#5C3D00', badgeText: '#FFFFFF' },
        flagship: { background: '#DB9E00', border: '#644400', badgeFill: '#5D4000', badgeText: '#FFF9E8', price: '#5F4000' }
      }
    }
  }
]

export const DEFAULT_PALETTE_V2 = PALETTES_V2.find((p) => p.id === 'midnight-gold')!

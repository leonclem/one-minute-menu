// Core data types for the QR Menu System

export interface User {
  id: string
  email: string
  plan: 'free' | 'premium' | 'enterprise'
  limits: PlanLimits
  createdAt: Date
  location?: string
  securityFlags?: string[]
  role?: 'user' | 'admin'
}

export interface PlanLimits {
  menus: number
  menuItems: number
  monthlyUploads: number
  aiImageGenerations: number
}

// Plan configurations
export const PLAN_CONFIGS: Record<User['plan'], PlanLimits> = {
  free: {
    menus: 1,
    menuItems: 20,
    monthlyUploads: 10,
    aiImageGenerations: 10,
  },
  premium: {
    menus: 10,
    menuItems: 500,
    monthlyUploads: 100,
    aiImageGenerations: 100,
  },
  enterprise: {
    menus: -1, // unlimited
    menuItems: -1,
    monthlyUploads: -1,
    aiImageGenerations: 1000,
  },
}

// Runtime, non-persisted limits by plan (e.g., rate limits)
export interface PlanRuntimeLimits {
  extractionRatePerHour: number
}

export const PLAN_RUNTIME_LIMITS: Record<User['plan'], PlanRuntimeLimits> = {
  free: {
    extractionRatePerHour: 6,
  },
  premium: {
    extractionRatePerHour: 20,
  },
  enterprise: {
    extractionRatePerHour: 60,
  },
}

export interface Menu {
  id: string
  userId: string
  name: string
  slug: string
  items: MenuItem[] // Flat items array (backward compatibility)
  categories?: MenuCategory[] // Stage 2: Hierarchical structure
  theme: MenuTheme
  version: number
  status: 'draft' | 'published'
  publishedAt?: Date
  imageUrl?: string
  qrCode?: QRCodeData
  paymentInfo?: PaymentInfo
  extractionMetadata?: ExtractionMetadata
  auditTrail: AuditEntry[]
  createdAt: Date
  updatedAt: Date
}

export interface MenuItem {
  id: string
  name: string
  description?: string
  price: number
  available: boolean
  category?: string
  order: number
  confidence?: number // Extraction confidence score
  
  // Stage 2 fields
  variants?: ItemVariant[]
  modifierGroups?: ModifierGroup[]
  additional?: AdditionalItemInfo
  type?: 'standard' | 'set_menu' | 'combo'
  setMenu?: SetMenu
  
  // AI Image Generation fields
  aiImageId?: string
  customImageUrl?: string
  imageSource: 'none' | 'ai' | 'custom'
  generationParams?: ImageGenerationParams
}

// Stage 2 Menu Item Extensions
export interface ItemVariant {
  size?: string
  price: number
  attributes?: Record<string, string | number | boolean>
  confidence?: number
}

export interface ModifierOption {
  name: string
  priceDelta?: number
}

export interface ModifierGroup {
  name: string
  type: 'single' | 'multi'
  required: boolean
  options: ModifierOption[]
}

export interface AdditionalItemInfo {
  servedWith?: string[]
  forPax?: number
  prepTimeMin?: number
  notes?: string
}

export interface SetMenuOption {
  name: string
  priceDelta?: number
}

export interface SetMenuCourse {
  name: string
  options: SetMenuOption[]
}

export interface SetMenu {
  courses: SetMenuCourse[]
  notes?: string
}

// Hierarchical Category Structure (Stage 2)
export interface MenuCategory {
  id: string
  name: string
  items: MenuItem[]
  subcategories?: MenuCategory[]
  confidence?: number
  order: number
}

// Extraction Metadata
export interface ExtractionMetadata {
  schemaVersion: 'stage1' | 'stage2'
  promptVersion: string
  confidence: number
  extractedAt: Date
  jobId?: string
}

export interface MenuTheme {
  id: string
  name: string
  colors: ColorPalette
  fonts: FontConfiguration
  layout: LayoutConfiguration
  wcagCompliant: boolean
  mobileOptimized: boolean
}

export interface ColorPalette {
  primary: string
  secondary: string
  accent: string
  background: string
  text: string
  extractionConfidence: number
}

export interface FontConfiguration {
  primary: string // Limited to whitelisted fonts (Inter, Noto Sans)
  secondary: string
  sizes: {
    heading: string
    body: string
    price: string
  }
}

export interface LayoutConfiguration {
  style: 'modern' | 'classic' | 'minimal'
  spacing: 'compact' | 'comfortable' | 'spacious'
  itemLayout: 'list' | 'grid' | 'card'
  currency?: string
}

export interface QRCodeData {
  id: string
  url: string
  imageUrl: string
  downloadUrls: {
    png: string
    pdf: string
  }
  createdAt: Date
}

export interface PaymentInfo {
  payNowQR?: string
  instructions?: string
  disclaimer: string // Required: "Payment handled by your bank app; platform does not process funds"
  alternativePayments?: string[]
  validated?: boolean
}

export interface AuditEntry {
  id: string
  action: 'created' | 'updated' | 'published' | 'reverted'
  changes: Record<string, any>
  version: number
  timestamp: Date
  userId: string
}

// OCR types removed - use extraction service types instead
// See src/lib/extraction/schema-stage1.ts and schema-stage2.ts



// Public Menu Types

export interface PublicMenu {
  id: string
  name: string
  items: PublicMenuItem[]
  theme: MenuTheme
  paymentInfo?: PaymentInfo
  lastUpdated: Date
  performanceBudget: PerformanceBudget
}

export interface PublicMenuItem {
  id: string
  name: string
  description?: string
  price: number
  available: boolean
  category?: string
  order: number
}

export interface PerformanceBudget {
  initialPayloadSize: number // Must be ≤130KB
  imageCount: number
  estimatedLoadTime: number // Target p75 ≤3s on 4G
}

// Analytics Types

export interface ViewMetadata {
  timestamp: Date
  userAgent?: string
  referrer?: string
  // No IP addresses or personally identifiable information
}

export interface MenuAnalytics {
  menuId: string
  date: string
  pageViews: number
  uniqueVisitors: number // Estimated via rotating localStorage identifier
}

// Design System Types

export interface PlatformTheme {
  id: string
  name: string
  version: string
  colors: {
    primary: string
    secondary: string
    accent: string
    background: string
    surface: string
    text: {
      primary: string
      secondary: string
      muted: string
    }
    border: string
    success: string
    warning: string
    error: string
  }
  typography: {
    fontFamily: {
      sans: string[]
      mono: string[]
    }
    fontSize: Record<string, string>
    fontWeight: Record<string, string>
    lineHeight: Record<string, string>
  }
  spacing: Record<string, string>
  borderRadius: Record<string, string>
  shadows: Record<string, string>
  breakpoints: Record<string, string>
}

export interface ComponentTheme {
  variants: Record<string, ComponentVariant>
  sizes?: Record<string, ComponentSize>
  states?: Record<string, ComponentState>
}

export interface ComponentVariant {
  base: string // Tailwind classes
  hover?: string
  focus?: string
  active?: string
  disabled?: string
}

export interface ComponentSize {
  base: string
  padding?: string
  fontSize?: string
}

export interface ComponentState {
  base: string
  styles: string
}

// API Response Types

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Form Types

export interface MenuFormData {
  name: string
  items: MenuItemFormData[]
  theme?: Partial<MenuTheme>
  paymentInfo?: Partial<PaymentInfo>
}

export interface MenuItemFormData {
  name: string
  description?: string
  price: number
  category?: string
  available: boolean
  
  // AI Image Generation fields (optional for form data)
  aiImageId?: string
  customImageUrl?: string
  imageSource?: 'none' | 'ai' | 'custom'
  generationParams?: ImageGenerationParams
}

export interface CreateMenuFormData {
  name: string
  slug?: string
  description?: string
}

// Validation schemas
export const VALIDATION_RULES = {
  menu: {
    name: {
      minLength: 1,
      maxLength: 100,
      required: true,
    },
    slug: {
      minLength: 1,
      maxLength: 50,
      pattern: /^[a-z0-9-]+$/,
      required: true,
    },
  },
  menuItem: {
    name: {
      minLength: 1,
      maxLength: 100,
      required: true,
    },
    description: {
      maxLength: 500,
    },
    price: {
      min: 0,
      max: 10000,
      required: true,
    },
  },
} as const

// Error Types

export interface AppError {
  code: string
  message: string
  details?: Record<string, any>
  timestamp: Date
}

export interface ValidationError extends AppError {
  field: string
  value: any
}

// AI Image Generation Types

export interface ImageGenerationParams {
  style?: 'rustic' | 'modern' | 'elegant' | 'casual'
  presentation?: 'white_plate' | 'wooden_board' | 'overhead' | 'closeup'
  lighting?: 'warm' | 'natural' | 'studio'
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  negativePrompt?: string
  customPromptAdditions?: string
}

export interface GeneratedImage {
  id: string
  menuItemId: string
  generationJobId?: string
  originalUrl: string
  thumbnailUrl: string
  mobileUrl: string
  desktopUrl: string
  webpUrl?: string
  prompt: string
  negativePrompt?: string
  aspectRatio: string
  width?: number
  height?: number
  fileSize?: number
  selected: boolean
  metadata?: Record<string, any>
  createdAt: Date
}

export interface ImageGenerationJob {
  id: string
  userId: string
  menuItemId: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  prompt: string
  negativePrompt?: string
  apiParams: NanoBananaParams
  numberOfVariations: number
  resultCount: number
  errorMessage?: string
  errorCode?: string
  processingTime?: number
  estimatedCost?: number
  retryCount: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
}

export interface NanoBananaParams {
  prompt: string
  negative_prompt?: string
  aspect_ratio?: string
  number_of_images?: number
  safety_filter_level?: 'block_none' | 'block_some' | 'block_most'
  person_generation?: 'allow' | 'dont_allow'
}

export interface GenerationQuota {
  id: string
  userId: string
  plan: 'free' | 'premium' | 'enterprise'
  monthlyLimit: number
  currentUsage: number
  resetDate: Date
  lastGenerationAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface GenerationAnalytics {
  id: string
  userId: string
  date: Date
  successfulGenerations: number
  failedGenerations: number
  totalVariations: number
  estimatedCost: number
  avgProcessingTime?: number
  metadata?: Record<string, any>
  createdAt: Date
}

export interface ImageGenerationRequest {
  userId: string
  menuItemId: string
  itemName: string
  itemDescription?: string
  generationNotes?: string
  styleParams: ImageGenerationParams
  numberOfVariations?: number
}

export interface QuotaStatus {
  userId: string
  plan: 'free' | 'premium' | 'enterprise'
  limit: number
  used: number
  remaining: number
  resetDate: Date
  warningThreshold: number
  needsUpgrade: boolean
}

export interface GenerationError {
  code: string
  message: string
  suggestions?: string[]
  retryable: boolean
}

// Utility Types

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
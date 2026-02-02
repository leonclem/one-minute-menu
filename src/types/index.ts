// Core data types for the QR Menu System

export type UserPlan = 'free' | 'grid_plus' | 'grid_plus_premium' | 'premium' | 'enterprise'

export interface User {
  id: string
  email: string
  plan: UserPlan
  limits: PlanLimits
  createdAt: Date
  location?: string
  securityFlags?: string[]
  role?: 'user' | 'admin'
  username?: string
  isApproved?: boolean
  approvedAt?: Date
  adminNotified?: boolean
  onboardingCompleted?: boolean
  restaurantName?: string
  establishmentType?: string
  primaryCuisine?: string
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
    menus: 1, // First menu is free
    menuItems: 20,
    monthlyUploads: 5,
    aiImageGenerations: 100,
  },
  grid_plus: {
    menus: 5,
    menuItems: 500,
    monthlyUploads: 100,
    aiImageGenerations: 100,
  },
  grid_plus_premium: {
    menus: -1, // unlimited
    menuItems: -1,
    monthlyUploads: -1,
    aiImageGenerations: 1000,
  },
  // Keep legacy for backward compatibility during transition
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
    extractionRatePerHour: 2,
  },
  grid_plus: {
    extractionRatePerHour: 20,
  },
  grid_plus_premium: {
    extractionRatePerHour: 60,
  },
  // Legacy
  premium: {
    extractionRatePerHour: 20,
  },
  enterprise: {
    extractionRatePerHour: 60,
  },
}

export interface UserPack {
  id: string
  userId: string
  packType: 'creator_pack'
  purchaseDate: Date
  expiresAt: Date
  editWindowEnd: Date
  isFreeTrial: boolean
  metadata?: Record<string, any>
}

export interface PurchaseRecord {
  id: string
  userId: string
  transactionId?: string
  productId: string
  amountCents: number
  currency: string
  status: 'success' | 'refunded' | 'failed'
  metadata?: Record<string, any>
  createdAt: Date
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
  /** Optional branding logo shown in templates and exports */
  logoUrl?: string
  /** Establishment details for AI and branding */
  establishmentType?: string
  primaryCuisine?: string
  /** Contact and location information */
  venueInfo?: VenueInfo
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

export interface VenueInfo {
  address?: string
  email?: string
  phone?: string
  socialMedia?: {
    instagram?: string
    facebook?: string
    x?: string
    tiktok?: string
    website?: string
  }
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
  establishmentType?: string
  primaryCuisine?: string
  venueInfo?: VenueInfo
}

export const ESTABLISHMENT_TYPES = [
  { id: 'bakery-dessert', label: 'Bakery & Desserts' },
  { id: 'hawker-foodcourt', label: 'Hawker Stall / Food Court' },
  { id: 'cafe-brunch', label: 'Cafe & Brunch' },
  { id: 'casual-dining', label: 'Casual Dining / Bistro' },
  { id: 'fine-dining', label: 'Fine Dining' },
  { id: 'experience-restaurant', label: 'Experience Restaurant' },
  { id: 'bar-pub', label: 'Bar & Pub' },
  { id: 'quick-service', label: 'Quick Service / Takeaway' },
  { id: 'other', label: 'Other' },
] as const

export const CUISINES = [
  { id: 'local-sg', label: 'Local (SG/Malay/Chinese/Indian)' },
  { id: 'peranakan', label: 'Peranakan / Nyonya' },
  { id: 'japanese', label: 'Japanese' },
  { id: 'korean', label: 'Korean' },
  { id: 'thai-viet', label: 'Thai / Vietnamese' },
  { id: 'mexican', label: 'Mexican' },
  { id: 'chinese', label: 'Chinese' },
  { id: 'indian', label: 'Indian' },
  { id: 'italian', label: 'Italian' },
  { id: 'western-fusion', label: 'Western / Fusion' },
  { id: 'other', label: 'Other' },
] as const

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
  presentation?: 'white_plate' | 'wooden_board' | 'overhead' | 'closeup' | 'bokeh' | 'none'
  lighting?: 'warm' | 'natural' | 'studio' | 'cinematic' | 'golden_hour'
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  negativePrompt?: string
  customPromptAdditions?: string
  establishmentType?: string
  primaryCuisine?: string
  hasReferenceImage?: boolean
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
  /**
   * Optional reference image(s) for style transfer / composition (text+image -> image).
   * `data` must be base64 (no data URL prefix).
   */
  reference_images?: Array<{
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
    data: string
    /**
     * Optional app-level hint describing what this reference image represents.
     * For food context: "dish", "scene", "style", "other"
     * For general context: "subject", "background", "style", "other"
     */
    role?: string
    /**
     * Optional user-provided comment/instruction for this specific reference image.
     * e.g., "use the bowl from this photo", "remove the herbs"
     */
    comment?: string
  }>
  /**
   * Optional hint to guide prompting for reference image workflows.
   * This is an application-level concept (not a strict model parameter).
   */
  reference_mode?: 'style_match' | 'composite'
  /**
   * Optional context hint for reference image role interpretation.
   * Affects how roles are described in prompts.
   */
  context?: 'food' | 'general'
  /**
   * Optional model override. Defaults to gemini-2.5-flash-image.
   */
  model?: string
  /**
   * Optional image size (e.g., "1K", "2K", "4K"). Used by Gemini 3 Pro.
   */
  image_size?: string
}

export interface GenerationQuota {
  id: string
  userId: string
  plan: UserPlan
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
  category?: string
  generationNotes?: string
  styleParams: ImageGenerationParams
  numberOfVariations?: number
}

export interface QuotaStatus {
  userId: string
  plan: UserPlan
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


// ============================================================================
// Stripe Payment Integration Types
// ============================================================================

/**
 * Request body for creating a Stripe Checkout Session
 */
export interface CheckoutRequest {
  productType: 'grid_plus' | 'grid_plus_premium' | 'creator_pack'
  successUrl?: string
  cancelUrl?: string
}

/**
 * Response from checkout session creation
 */
export interface CheckoutResponse {
  sessionId?: string
  url?: string
  grantedFree?: boolean  // True if free pack was granted directly
}

/**
 * Error response from checkout
 */
export interface CheckoutError {
  error: string
  code: string
  timestamp?: string
  retryAfter?: number
  details?: Record<string, any>
}

/**
 * Request body for creating a Customer Portal session
 */
export interface CustomerPortalRequest {
  returnUrl?: string
}

/**
 * Response from Customer Portal session creation
 */
export interface CustomerPortalResponse {
  url: string
}


// ============================================================================
// Railway Workers - Export Job Types
// ============================================================================

/**
 * Job status enum for export jobs
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Export type enum
 */
export enum ExportType {
  PDF = 'pdf',
  IMAGE = 'image'
}

/**
 * Export job record
 */
export interface ExportJob {
  id: string
  user_id: string
  menu_id: string
  export_type: ExportType
  status: JobStatus
  priority: number
  retry_count: number
  error_message?: string
  file_url?: string
  storage_path?: string
  available_at: Date
  metadata: ExportJobMetadata
  worker_id?: string
  created_at: Date
  updated_at: Date
  started_at?: Date
  completed_at?: Date
}

/**
 * Complete snapshot of menu state at job creation time.
 * This data is frozen and stored in the export_jobs.metadata JSONB column.
 * Ensures that menu edits after job creation don't affect the export output.
 */
export interface RenderSnapshot {
  // Template information
  template_id: string // UUID of the template being used
  template_version: string // Version identifier for template compatibility
  template_name: string // Human-readable template name (e.g., "elegant-dark")
  
  // V2 Configuration
  configuration?: {
    palette?: any
    typography?: any
    layout?: any
    textures?: any
    features?: any
  }
  
  // Menu data (frozen state)
  menu_data: {
    id: string // Menu UUID
    name: string // Menu name for display
    description?: string // Menu description
    logo_url?: string // Restaurant logo URL (Supabase Storage)
    establishment_name?: string // Restaurant name
    establishment_address?: string
    establishment_phone?: string
    /** Raw venue info from DB (used for V2 footer: address/phone/email/social) */
    venue_info?: VenueInfo
    
    // Menu items with full details
    items: Array<{
      id: string
      name: string
      description?: string
      price?: number
      currency?: string
      category?: string
      image_url?: string // Supabase Storage URL
      display_order: number
      
      // Modifiers and variants
      modifiers?: Array<{
        id: string
        name: string
        options: Array<{
          name: string
          price_adjustment?: number
        }>
      }>
      
      variants?: Array<{
        id: string
        name: string
        price?: number
      }>

      // Item indicators
      indicators?: {
        dietary: string[]
        spiceLevel: number | null
        allergens: string[]
      }
    }>
    
    // Categories for organization
    categories?: Array<{
      name: string
      display_order: number
    }>
  }
  
  // Export options
  export_options: {
    format?: 'A4' | 'Letter'
    orientation?: 'portrait' | 'landscape'
    include_images?: boolean
    include_prices?: boolean
  }
  
  // Metadata for debugging
  snapshot_created_at: string // ISO timestamp
  snapshot_version: string // Schema version (e.g., "1.0")
}

/**
 * Export job metadata stored in JSONB column
 */
export interface ExportJobMetadata {
  format?: 'A4' | 'Letter'
  orientation?: 'portrait' | 'landscape'
  worker_version?: string
  render_time_ms?: number
  file_size_bytes?: number
  puppeteer_version?: string
  menu_name?: string // User-friendly name for downloads
  render_snapshot?: RenderSnapshot // Snapshot of render input at job creation
}

/**
 * PDF rendering options
 */
export interface PDFOptions {
  format: 'A4' | 'Letter'
  orientation: 'portrait' | 'landscape'
  printBackground: boolean
  margin: {
    top: string
    right: string
    bottom: string
    left: string
  }
}

/**
 * Image rendering options
 */
export interface ImageOptions {
  type: 'png' | 'jpeg'
  quality?: number // 0-100 for JPEG
  fullPage: boolean
  omitBackground: boolean
}

/**
 * Worker configuration
 */
export interface WorkerConfig {
  database_url: string
  supabase_url: string
  supabase_service_role_key: string
  storage_bucket: string
  sendgrid_api_key: string
  puppeteer_executable_path?: string
  max_concurrent_renders: number // Default 3
  job_timeout_seconds: number // Default 60
  polling_interval_busy_ms: number // Default 2000
  polling_interval_idle_ms: number // Default 5000
  graceful_shutdown_timeout_ms: number // Default 30000
  worker_id: string // Unique identifier for this worker instance
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  free_user_hourly_limit: number // 10
  subscriber_hourly_limit: number // 50
  free_user_pending_limit: number // 5
  subscriber_pending_limit: number // 20
}

/**
 * Queue statistics
 */
export interface QueueStats {
  pending_count: number
  processing_count: number
  completed_count_24h: number
  failed_count_24h: number
  average_processing_time_seconds: number
  oldest_pending_job_age_seconds: number
}

/**
 * Validation result for rendered output
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
  file_size: number
  format_verified: boolean
}

/**
 * Error categories for retry logic
 */
export enum ErrorCategory {
  TRANSIENT = 'transient', // Network timeout, temporary DB issue - retry
  PERMANENT = 'permanent', // Invalid HTML, missing menu - don't retry
  RESOURCE = 'resource', // OOM, timeout - retry with backoff
  VALIDATION = 'validation' // Bad output format - don't retry
}

/**
 * Error classification for retry decisions
 */
export interface ErrorClassification {
  category: ErrorCategory
  should_retry: boolean
  user_message: string // Friendly message for user
  internal_message: string // Detailed message for logs
}

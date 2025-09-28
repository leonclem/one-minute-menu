// Core data types for the QR Menu System

export interface User {
  id: string
  email: string
  plan: 'free' | 'premium' | 'enterprise'
  limits: PlanLimits
  createdAt: Date
  location?: string
  securityFlags?: string[]
}

export interface PlanLimits {
  menus: number
  menuItems: number
  ocrJobs: number
  monthlyUploads: number
}

// Plan configurations
export const PLAN_CONFIGS: Record<User['plan'], PlanLimits> = {
  free: {
    menus: 1,
    menuItems: 20,
    ocrJobs: 5,
    monthlyUploads: 10,
  },
  premium: {
    menus: 10,
    menuItems: 500,
    ocrJobs: 50,
    monthlyUploads: 100,
  },
  enterprise: {
    menus: -1, // unlimited
    menuItems: -1,
    ocrJobs: -1,
    monthlyUploads: -1,
  },
}

export interface Menu {
  id: string
  userId: string
  name: string
  slug: string
  items: MenuItem[]
  theme: MenuTheme
  version: number
  status: 'draft' | 'published'
  publishedAt?: Date
  imageUrl?: string
  qrCode?: QRCodeData
  paymentInfo?: PaymentInfo
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
  confidence?: number // OCR confidence score
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

// OCR and AI Processing Types

export interface OCRJob {
  id: string
  userId: string
  imageHash: string // SHA-256 for idempotency
  imageUrl: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  result?: OCRResult
  error?: string
  createdAt: Date
  processingTime?: number
  retryCount: number
}

export interface OCRResult {
  extractedItems: MenuItem[]
  confidence: number
  flaggedFields: string[]
  processingTime: number
  ocrText: string
  aiParsingUsed: boolean
  tokenUsage?: {
    input: number
    output: number
    cost: number
  }
}

export interface QuotaStatus {
  remaining: number
  resetDate: Date
  planLimit: number
  upgradeRequired: boolean
}

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

// Utility Types

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>
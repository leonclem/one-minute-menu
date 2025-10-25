import { z } from 'zod'

// User customization schema shared across requests
export const userCustomizationSchema = z.object({
  colors: z
    .object({
      primary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      secondary: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
      accent: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
    })
    .optional(),
  fonts: z
    .object({
      heading: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
  priceDisplayMode: z.enum(['symbol', 'amount-only']).optional(),
})

// Render request schema
export const renderRequestSchema = z.object({
  menuId: z.string().uuid(),
  templateId: z.string().uuid(),
  customization: userCustomizationSchema.optional(),
  format: z.enum(['html', 'pdf', 'png']).default('html'),
})

// Export request schema
export const exportRequestSchema = z.object({
  menuId: z.string().uuid(),
  templateId: z.string().uuid(),
  customization: userCustomizationSchema.optional(),
  format: z.enum(['pdf', 'png', 'html']),
  filename: z.string().min(1).max(255),
  pageSize: z.enum(['A4', 'US_LETTER', 'TABLOID']).optional(),
  dpi: z.number().min(72).max(600).optional(),
  includeBleed: z.boolean().optional(),
})

// Update user preference schema
export const updatePreferenceSchema = z.object({
  menuId: z.string().uuid(),
  templateId: z.string().uuid(),
  customization: userCustomizationSchema,
  isDefault: z.boolean().optional(),
})

export type RenderRequest = z.infer<typeof renderRequestSchema>
export type ExportRequest = z.infer<typeof exportRequestSchema>
export type UpdatePreferenceRequest = z.infer<typeof updatePreferenceSchema>



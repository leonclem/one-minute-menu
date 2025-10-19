'use client'

import { useState, useEffect } from 'react'
import type { TemplateConfig, UserCustomization, PriceDisplayMode } from '@/types/templates'

export interface TemplateCustomizerProps {
  templateId: string
  currentCustomization?: UserCustomization
  onChange: (customization: UserCustomization) => void
}

const AVAILABLE_FONTS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Noto Sans', label: 'Noto Sans' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Open Sans', label: 'Open Sans' },
  { value: 'Lato', label: 'Lato' },
]

export function TemplateCustomizer({
  templateId,
  currentCustomization,
  onChange,
}: TemplateCustomizerProps) {
  const [templateConfig, setTemplateConfig] = useState<TemplateConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [customization, setCustomization] = useState<UserCustomization>(
    currentCustomization || {}
  )

  // Load template configuration
  useEffect(() => {
    async function loadTemplate() {
      try {
        setLoading(true)
        const response = await fetch(`/api/templates/${templateId}`)
        if (!response.ok) {
          throw new Error('Failed to load template')
        }
        const data = await response.json()
        setTemplateConfig(data.template)
      } catch (err) {
        console.error('Failed to load template config:', err)
      } finally {
        setLoading(false)
      }
    }

    if (templateId) {
      loadTemplate()
    }
  }, [templateId])

  // Update customization and notify parent
  const updateCustomization = (updates: Partial<UserCustomization>) => {
    const newCustomization = { ...customization, ...updates }
    setCustomization(newCustomization)
    onChange(newCustomization)
  }

  const updateColor = (role: string, value: string) => {
    updateCustomization({
      colors: {
        ...customization.colors,
        [role]: value,
      },
    })
  }

  const updateFont = (role: string, value: string) => {
    updateCustomization({
      fonts: {
        ...customization.fonts,
        [role]: value,
      },
    })
  }

  const updatePriceDisplayMode = (mode: PriceDisplayMode) => {
    updateCustomization({
      priceDisplayMode: mode,
    })
  }

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">Loading customization options...</p>
      </div>
    )
  }

  if (!templateConfig) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600">No customization options available</p>
      </div>
    )
  }

  const { customization: customizationOptions } = templateConfig
  const hasCustomization =
    customizationOptions.allowColorCustomization ||
    customizationOptions.allowFontCustomization

  if (!hasCustomization) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-sm text-gray-600">
          This template does not support customization
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6 bg-white rounded-lg border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-900">Customize Template</h3>

      {/* Color Customization */}
      {customizationOptions.allowColorCustomization &&
        customizationOptions.customizableColors.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Colors</h4>
            <div className="space-y-3">
              {customizationOptions.customizableColors.map(colorRole => (
                <div key={colorRole} className="flex items-center gap-3">
                  <label
                    htmlFor={`color-${colorRole}`}
                    className="text-sm text-gray-700 capitalize w-24"
                  >
                    {colorRole}
                  </label>
                  <input
                    id={`color-${colorRole}`}
                    type="color"
                    value={customization.colors?.[colorRole] || '#000000'}
                    onChange={(e) => updateColor(colorRole, e.target.value)}
                    className="w-12 h-10 rounded border border-gray-300 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={customization.colors?.[colorRole] || '#000000'}
                    onChange={(e) => updateColor(colorRole, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="#000000"
                    pattern="^#[0-9A-Fa-f]{6}$"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Font Customization */}
      {customizationOptions.allowFontCustomization &&
        customizationOptions.customizableFonts.length > 0 && (
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Fonts</h4>
            <div className="space-y-3">
              {customizationOptions.customizableFonts.map(fontRole => (
                <div key={fontRole} className="flex items-center gap-3">
                  <label
                    htmlFor={`font-${fontRole}`}
                    className="text-sm text-gray-700 capitalize w-24"
                  >
                    {fontRole}
                  </label>
                  <select
                    id={`font-${fontRole}`}
                    value={customization.fonts?.[fontRole] || ''}
                    onChange={(e) => updateFont(fontRole, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Default</option>
                    {AVAILABLE_FONTS.map(font => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Price Display Mode */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700">Price Display</h4>
        <div className="flex gap-3">
          <button
            onClick={() => updatePriceDisplayMode('symbol')}
            className={`flex-1 px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
              (customization.priceDisplayMode || 'symbol') === 'symbol'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <div className="font-medium">With Symbol</div>
            <div className="text-xs mt-1 opacity-75">e.g., $12.50</div>
          </button>
          <button
            onClick={() => updatePriceDisplayMode('amount-only')}
            className={`flex-1 px-4 py-2 text-sm rounded-lg border-2 transition-colors ${
              customization.priceDisplayMode === 'amount-only'
                ? 'border-blue-600 bg-blue-50 text-blue-900'
                : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
            }`}
          >
            <div className="font-medium">Amount Only</div>
            <div className="text-xs mt-1 opacity-75">e.g., 12.50</div>
          </button>
        </div>
      </div>

      {/* Reset Button */}
      <div className="pt-4 border-t border-gray-200">
        <button
          onClick={() => {
            setCustomization({})
            onChange({})
          }}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

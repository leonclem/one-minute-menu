'use client'

import type { CategoryV2 } from '@/types/templates'
import type { PreflightWarning, PreflightError } from '@/types/templates'

export interface PreflightPanelProps {
  menuData: { categories: CategoryV2[] }
  onProceed: () => void
  onCancel: () => void
}

export function PreflightPanel({
  menuData,
  onProceed,
  onCancel,
}: PreflightPanelProps) {
  const { warnings, errors } = runPreflightChecks(menuData)

  const hasIssues = warnings.length > 0 || errors.length > 0
  const canProceed = errors.length === 0

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-lg max-w-2xl">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">
          Export Preflight Check
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          Review these items before exporting your menu
        </p>
      </div>

      {/* Content */}
      <div className="px-6 py-4 max-h-96 overflow-y-auto">
        {!hasIssues ? (
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
            <svg
              className="w-6 h-6 text-green-600 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p className="font-medium text-green-900">All checks passed!</p>
              <p className="text-sm text-green-700 mt-0.5">
                Your menu is ready to export
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Errors */}
            {errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Errors ({errors.length})
                </h4>
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <div
                      key={index}
                      className="p-3 bg-red-50 border border-red-200 rounded-lg"
                    >
                      <p className="text-sm text-red-900">{error.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-yellow-900 flex items-center gap-2">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  Warnings ({warnings.length})
                </h4>
                <div className="space-y-2">
                  {warnings.map((warning, index) => (
                    <div
                      key={index}
                      className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                    >
                      <p className="text-sm text-yellow-900">{warning.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          {warnings.length > 0 && canProceed && (
            <p className="text-xs text-gray-600">
              You can proceed despite warnings
            </p>
          )}
          <button
            onClick={onProceed}
            disabled={!canProceed}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canProceed
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {canProceed ? 'Proceed with Export' : 'Fix Errors to Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper function to run preflight checks
function runPreflightChecks(menuData: {
  categories: CategoryV2[]
}): {
  warnings: PreflightWarning[]
  errors: PreflightError[]
} {
  const warnings: PreflightWarning[] = []
  const errors: PreflightError[] = []

  // Check if there are any categories
  if (!menuData.categories || menuData.categories.length === 0) {
    errors.push({
      type: 'no_categories',
      message: 'Your menu has no categories. Please add at least one category.',
    })
    return { warnings, errors }
  }

  // Check each category
  menuData.categories.forEach((category, catIndex) => {
    // Check for empty categories
    if (!category.items || category.items.length === 0) {
      warnings.push({
        type: 'empty_category',
        message: `Category "${category.name}" has no items`,
        categoryId: `category-${catIndex}`,
      })
    }

    // Check items in category
    category.items?.forEach((item, itemIndex) => {
      // Check for missing prices
      if (!item.price || item.price === 0) {
        warnings.push({
          type: 'missing_price',
          message: `Item "${item.name}" in "${category.name}" has no price`,
          itemId: `item-${catIndex}-${itemIndex}`,
          categoryId: `category-${catIndex}`,
        })
      }

      // Check for low confidence items
      if (item.confidence && item.confidence < 0.7) {
        warnings.push({
          type: 'low_confidence',
          message: `Item "${item.name}" in "${category.name}" has low confidence (${Math.round(item.confidence * 100)}%)`,
          itemId: `item-${catIndex}-${itemIndex}`,
          categoryId: `category-${catIndex}`,
        })
      }
    })
  })

  return { warnings, errors }
}

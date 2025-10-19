'use client'

import type { TemplateMetadata } from '@/types/templates'
import Image from 'next/image'

export interface TemplateCardProps {
  template: TemplateMetadata
  isSelected: boolean
  onClick: () => void
}

export function TemplateCard({ template, isSelected, onClick }: TemplateCardProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left rounded-lg border-2 transition-all
        hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${
          isSelected
            ? 'border-blue-600 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      {/* Premium Badge */}
      {template.isPremium && (
        <div className="absolute top-2 right-2 z-10">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
            <svg
              className="w-3 h-3 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Premium
          </span>
        </div>
      )}

      {/* Selected Indicator */}
      {isSelected && (
        <div className="absolute top-2 left-2 z-10">
          <div className="flex items-center justify-center w-6 h-6 bg-blue-600 rounded-full">
            <svg
              className="w-4 h-4 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}

      {/* Thumbnail */}
      <div className="relative w-full aspect-[3/4] bg-gray-100 rounded-t-lg overflow-hidden">
        <Image
          src={template.thumbnailUrl}
          alt={template.name}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        />
      </div>

      {/* Content */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 line-clamp-1">
          {template.name}
        </h3>
        
        <p className="text-sm text-gray-600 line-clamp-2">
          {template.description}
        </p>

        {/* Metadata */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100">
            {template.pageFormat.replace('_', ' ')}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 capitalize">
            {template.orientation}
          </span>
        </div>

        {/* Tags */}
        {template.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map(tag => (
              <span
                key={tag}
                className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                +{template.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}

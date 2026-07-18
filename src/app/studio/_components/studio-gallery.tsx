'use client'

import type { StudioImageRecord } from '@/lib/studio/types'

interface StudioGalleryProps {
  images: StudioImageRecord[]
  busy: boolean
  onUseAsWorking: (image: StudioImageRecord) => void
  onToggleFavourite: (image: StudioImageRecord) => void
  onArchive: (image: StudioImageRecord) => void
  onDelete: (image: StudioImageRecord) => void
  onDownload: (image: StudioImageRecord) => void
}

function formatMeta(image: StudioImageRecord): string {
  const when = new Date(image.created_at).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
  const role = image.role === 'source' ? 'Source' : 'Generated'
  const model =
    image.model?.includes('flash') || image.model?.includes('Flash')
      ? 'Standard'
      : image.model
        ? 'Pro'
        : null
  return [role, when, model].filter(Boolean).join(' · ')
}

export function StudioGallery({
  images,
  busy,
  onUseAsWorking,
  onToggleFavourite,
  onArchive,
  onDelete,
  onDownload,
}: StudioGalleryProps) {
  const sorted = [...images].sort((a, b) => {
    if (a.is_favourite !== b.is_favourite) return a.is_favourite ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  return (
    <section className="rounded-lg border border-black/[0.08] bg-white/90 p-5 shadow-md backdrop-blur-sm">
      <h2 className="mb-1 text-base font-semibold text-gray-900">Dish library</h2>
      <p className="mb-4 text-xs text-gray-500">
        Source uploads and generated variants for this dish. Use any image as the working photo
        for further edits.
      </p>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500" data-testid="studio-gallery-empty">
          No images yet for this dish. Upload a food photo to start — your library fills as you
          generate.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="studio-gallery">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="space-y-1.5 rounded-md border border-gray-100 bg-white/80 p-2"
              data-testid="studio-gallery-item"
            >
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.public_url}
                  alt={`${item.role} studio image`}
                  className="aspect-square w-full rounded-md border border-gray-200 object-cover"
                />
                {item.is_favourite && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    Default
                  </span>
                )}
              </div>
              <p className="truncate text-[11px] text-gray-500">{formatMeta(item)}</p>
              <div className="flex flex-wrap gap-x-2 gap-y-1">
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                  onClick={() => onUseAsWorking(item)}
                >
                  Use as working
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-gray-700 hover:text-gray-900 disabled:opacity-50"
                  onClick={() => onToggleFavourite(item)}
                >
                  {item.is_favourite ? 'Unfavourite' : 'Favourite'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-blue-700 hover:text-blue-900 disabled:opacity-50"
                  onClick={() => onDownload(item)}
                >
                  Download
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-amber-800 hover:text-amber-950 disabled:opacity-50"
                  onClick={() => onArchive(item)}
                >
                  Archive
                </button>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-medium text-red-700 hover:text-red-900 disabled:opacity-50"
                  onClick={() => {
                    if (window.confirm('Permanently delete this image?')) {
                      onDelete(item)
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

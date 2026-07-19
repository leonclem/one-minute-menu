'use client'

import type { StudioDishListItem } from '@/lib/studio/types'

interface StudioDishPickerModalProps {
  open: boolean
  dishes: StudioDishListItem[]
  activeDishId: string
  busy?: boolean
  loading?: boolean
  onSelect: (dishId: string) => void
  onClose: () => void
}

export function StudioDishPickerModal({
  open,
  dishes,
  activeDishId,
  busy = false,
  loading = false,
  onSelect,
  onClose,
}: StudioDishPickerModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-dish-picker-title"
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-lg bg-white shadow-lg"
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 id="studio-dish-picker-title" className="font-medium text-gray-900">
            Your dishes
          </h3>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-gray-500">Loading dishes…</p>
          ) : dishes.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-gray-500">No dishes yet.</p>
          ) : (
            <ul className="space-y-1" data-testid="studio-dish-picker-list">
              {dishes.map((dish) => {
                const selected = dish.id === activeDishId
                return (
                  <li key={dish.id}>
                    <button
                      type="button"
                      disabled={busy}
                      aria-current={selected ? 'true' : undefined}
                      className={[
                        'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                        selected
                          ? 'bg-ux-primary/10 ring-1 ring-ux-primary/40'
                          : 'hover:bg-gray-50',
                        busy && 'opacity-60',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => onSelect(dish.id)}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-gray-200 bg-gray-100">
                        {dish.current_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={dish.current_image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] font-medium uppercase tracking-wide text-gray-400">
                            Empty
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{dish.name}</p>
                        {selected && (
                          <p className="text-xs text-ux-primary">Currently open</p>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

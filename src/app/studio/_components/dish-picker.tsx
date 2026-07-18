'use client'

import type { StudioDishRecord } from '@/lib/studio/types'

interface DishPickerProps {
  dishes: StudioDishRecord[]
  activeDishId: string
  busy: boolean
  onSelect: (dishId: string) => void
  onCreate: (name: string) => Promise<void>
  onRename: (dishId: string, name: string) => Promise<void>
  onDelete: (dishId: string) => Promise<void>
}

export function DishPicker({
  dishes,
  activeDishId,
  busy,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: DishPickerProps) {
  const active = dishes.find((d) => d.id === activeDishId) ?? dishes[0]

  return (
    <section
      className="rounded-lg border border-black/[0.08] bg-white/90 p-5 shadow-md backdrop-blur-sm"
      data-testid="dish-picker"
    >
      <h2 className="mb-3 text-base font-semibold text-gray-900">Dish</h2>
      <p className="mb-4 text-xs text-gray-500">
        Images are saved under the selected dish. Create a dish per menu item you photograph.
      </p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block flex-1 text-sm">
          <span className="mb-1 block font-medium text-gray-700">Active dish</span>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            value={activeDishId}
            disabled={busy || dishes.length === 0}
            onChange={(e) => onSelect(e.target.value)}
            data-testid="dish-select"
          >
            {dishes.map((dish) => (
              <option key={dish.id} value={dish.id}>
                {dish.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          disabled={busy}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          data-testid="dish-create-button"
          onClick={() => {
            const name = window.prompt('New dish name')
            if (name?.trim()) void onCreate(name.trim())
          }}
        >
          New dish
        </button>

        <button
          type="button"
          disabled={busy || !active}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          data-testid="dish-rename-button"
          onClick={() => {
            if (!active) return
            const name = window.prompt('Rename dish', active.name)
            if (name?.trim() && name.trim() !== active.name) {
              void onRename(active.id, name.trim())
            }
          }}
        >
          Rename
        </button>

        <button
          type="button"
          disabled={busy || !active || dishes.length <= 1}
          className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          data-testid="dish-delete-button"
          title={
            dishes.length <= 1
              ? 'Keep at least one dish'
              : 'Delete only when this dish has no active images'
          }
          onClick={() => {
            if (!active) return
            if (
              window.confirm(
                `Delete “${active.name}”? Archive or delete its images first if any remain.`,
              )
            ) {
              void onDelete(active.id)
            }
          }}
        >
          Delete
        </button>
      </div>
    </section>
  )
}

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import { dishGridStatusText } from '@/lib/studio/dish-list-stats'
import type { StudioAccessReason } from '@/lib/studio/access/studio-access-decision'
import type { AccessMode } from '@/lib/studio/access/studio-access-mode'
import type { StudioDishListItem } from '@/lib/studio/types'

import { StudioFirstRunPanel } from './studio-first-run-panel'
import { StudioTextModal } from './studio-text-modal'

interface StudioDishesHomeProps {
  dishes: StudioDishListItem[]
  accessMode: AccessMode
  accessReason: StudioAccessReason
  isAdmin: boolean
  studioFirstRunDismissed: boolean
}

function DishThumb({ dish }: { dish: StudioDishListItem }) {
  if (dish.current_image_url) {
    return (
      // User-uploaded storage URLs vary by env; skip the Next optimizer.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={dish.current_image_url}
        alt=""
        className="h-full w-full object-cover"
      />
    )
  }

  const letter = (dish.name.trim()[0] || '?').toUpperCase()
  return (
    <div className="flex h-full w-full items-center justify-center bg-white/[0.04] text-4xl font-extrabold tracking-[-0.03em] text-white/40">
      {letter}
    </div>
  )
}

export function StudioDishesHome({
  dishes,
  accessMode,
  accessReason,
  isAdmin,
  studioFirstRunDismissed,
}: StudioDishesHomeProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [firstRunDismissed, setFirstRunDismissed] = useState(studioFirstRunDismissed)

  const openCreate = useCallback(() => {
    setCreateError(null)
    setCreateOpen(true)
  }, [])

  const handleCreate = useCallback(
    async (name: string) => {
      setCreateOpen(false)
      setCreating(true)
      setCreateError(null)
      try {
        const res = await fetch('/api/studio/dishes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error((err as { error?: string } | null)?.error ?? 'Failed to create dish')
        }
        const data = (await res.json()) as { dish: { id: string } }
        router.push(`/studio/${data.dish.id}`)
      } catch (err) {
        setCreateError(err instanceof Error ? err.message : 'Failed to create dish')
        setCreating(false)
      }
    },
    [router],
  )

  const handleFirstRunDismiss = useCallback(async () => {
    const res = await fetch('/api/studio/onboarding', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dismissed: true }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => null)
      throw new Error((err as { error?: string } | null)?.error ?? 'Failed to save preference')
    }
    setFirstRunDismissed(true)
  }, [])

  const empty = dishes.length === 0
  const showFirstRun = !firstRunDismissed
  const firstRunTakeover = empty && showFirstRun

  return (
    <div>
      {firstRunTakeover ? null : (
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold tracking-[-0.03em] text-white sm:text-[1.35rem]">
              Your dishes
            </h1>
            <p className="mt-1 text-sm text-white/55">
              Open a dish to edit its photos, or add another.
            </p>
          </div>
          <button
            type="button"
            className="studio-btn-primary"
            disabled={creating}
            onClick={openCreate}
          >
            + New dish
          </button>
        </div>
      )}

      {createError ? (
        <p role="alert" className="mb-4 text-sm text-[#ff8a80]">
          {createError}
        </p>
      ) : null}

      {showFirstRun ? (
        <div className="mb-6">
          <StudioFirstRunPanel
            onOpenFilePicker={openCreate}
            onDismiss={handleFirstRunDismiss}
            accessMode={accessMode}
            accessReason={accessReason}
            isAdmin={isAdmin}
            canDismiss={!empty}
          />
        </div>
      ) : null}

      {empty && firstRunDismissed ? (
        <p className="rounded-[16px] border border-white/[0.1] bg-[#0f1c1f] px-4 py-10 text-center text-sm text-white/55">
          No dishes yet. Create one to upload a photo.
        </p>
      ) : null}

      {dishes.length > 0 ? (
        <ul
          className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5"
          data-testid="studio-dishes-grid"
        >
          {dishes.map((dish) => (
            <li key={dish.id} className="h-full">
              <Link href={`/studio/${dish.id}`} className="studio-dish-card">
                <div className="aspect-[4/5] w-full overflow-hidden bg-black/20">
                  <DishThumb dish={dish} />
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-sm font-bold text-white">{dish.name}</p>
                  <p className="mt-0.5 text-xs text-white/40">{dishGridStatusText(dish)}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      <StudioTextModal
        open={createOpen}
        title="Name your dish"
        label="What is the dish?"
        helperText="Use a clear food name, such as “Double cheeseburger”, rather than a menu nickname such as “EZ Cheezey”. We use this to tailor editing suggestions. You can rename it later."
        confirmText="Create"
        onCancel={() => setCreateOpen(false)}
        onConfirm={(name) => void handleCreate(name)}
      />
    </div>
  )
}

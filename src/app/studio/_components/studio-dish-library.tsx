'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useMemo, useRef, useState } from 'react'

import { ConfirmDialog } from '@/components/ui'
import { uploadStudioSourceFile, removeStudioStorageObject } from '@/lib/studio/client-upload'
import { chronologicalShots } from '@/lib/studio/lineage'
import {
  parseStudioLibraryTab,
  parseStudioLibraryView,
  studioLibraryHref,
  type StudioLibraryTab,
  type StudioLibraryView,
} from '@/lib/studio/library-query'
import type { StudioDishRecord, StudioImageRecord } from '@/lib/studio/types'

import { StudioExportMatrix } from './studio-export-matrix'
import { StudioLibraryHeader } from './studio-library-header'
import { StudioLibraryTabs } from './studio-library-tabs'
import { StudioShotCard } from './studio-shot-card'
import { StudioShotTree } from './studio-shot-tree'
import { StudioTextModal } from './studio-text-modal'
import { useStudioDishExports } from './use-studio-dish-exports'

interface StudioDishLibraryProps {
  dish: StudioDishRecord
  images: StudioImageRecord[]
  dishCount: number
  initialTab?: string
  initialView?: string
}

export function StudioDishLibrary({
  dish,
  images: initialImages,
  dishCount,
  initialTab,
  initialView,
}: StudioDishLibraryProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [images, setImages] = useState(initialImages)
  const [name, setName] = useState(dish.name)
  const [tab, setTab] = useState<StudioLibraryTab>(parseStudioLibraryTab(initialTab))
  const [view, setView] = useState<StudioLibraryView>(parseStudioLibraryView(initialView))
  const [renameOpen, setRenameOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteSummary, setDeleteSummary] = useState<{ imageCount: number; exportVariantCount: number } | null>(
    null,
  )
  const [imageToDelete, setImageToDelete] = useState<StudioImageRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dishBlocked = Boolean(dish.generation_blocked_at)
  const exports = useStudioDishExports(dish.id)
  const tilesByImageId = useMemo(
    () => new Map(exports.shots.map((shot) => [shot.imageId, shot.tiles])),
    [exports.shots],
  )
  const shotCount = chronologicalShots(images).length
  const readyExportCount = useMemo(
    () =>
      exports.shots.reduce(
        (total, shot) => total + shot.tiles.filter((tile) => tile.status === 'ready').length,
        0,
      ),
    [exports.shots],
  )
  const currentImage = useMemo(() => {
    const ordered = chronologicalShots(images)
    return ordered.find((image) => image.id === dish.current_image_id) ?? ordered.at(-1) ?? null
  }, [dish.current_image_id, images])

  const replaceUrl = useCallback(
    (nextTab: StudioLibraryTab, nextView: StudioLibraryView) => {
      router.replace(studioLibraryHref(dish.id, nextTab, nextView), { scroll: false })
    },
    [dish.id, router],
  )

  const handleNewShot = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      setBusy(true)
      setError(null)
      let storagePath: string | null = null
      try {
        const upload = await uploadStudioSourceFile(file)
        if (!upload.ok) throw new Error(upload.error)
        storagePath = upload.storagePath
        const sourceRes = await fetch('/api/studio/source', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageId: upload.imageId,
            dishId: dish.id,
            mimeType: upload.mimeType,
          }),
        })
        if (!sourceRes.ok) {
          const err = await sourceRes.json().catch(() => null)
          throw new Error((err as { error?: string } | null)?.error ?? 'Failed to save uploaded image.')
        }
        const sourceData = (await sourceRes.json()) as { imageId?: string; imageUrl?: string }
        if (!sourceData.imageId || !sourceData.imageUrl) throw new Error('Failed to save uploaded image.')
        storagePath = null
        setImages((prev) => [
          ...prev,
          {
            id: sourceData.imageId as string,
            user_id: dish.user_id,
            dish_id: dish.id,
            role: 'source',
            source_image_id: null,
            storage_path: upload.storagePath,
            public_url: sourceData.imageUrl as string,
            mime_type: upload.mimeType,
            width: null,
            height: null,
            prompt: null,
            model: null,
            metadata: {},
            is_favourite: false,
            archived_at: null,
            created_at: new Date().toISOString(),
          },
        ])
        void exports.refresh()
      } catch (err) {
        if (storagePath) void removeStudioStorageObject(storagePath)
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setBusy(false)
      }
    },
    [dish.id, dish.user_id, exports],
  )

  const handleRename = useCallback(
    async (nextName: string) => {
      setRenameOpen(false)
      setBusy(true)
      setError(null)
      try {
        const res = await fetch(`/api/studio/dishes/${dish.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: nextName }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => null)
          throw new Error((err as { error?: string } | null)?.error ?? 'Failed to rename dish')
        }
        setName(nextName)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to rename dish')
      } finally {
        setBusy(false)
      }
    },
    [dish.id],
  )

  const openDelete = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/studio/dishes/${dish.id}`)
      if (!res.ok) throw new Error('Failed to prepare deletion')
      const data = (await res.json()) as {
        deletionSummary: { imageCount: number; exportVariantCount: number }
      }
      setDeleteSummary(data.deletionSummary)
      setDeleteOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to prepare deletion')
    } finally {
      setBusy(false)
    }
  }, [dish.id])

  const handleDelete = useCallback(async () => {
    setDeleteOpen(false)
    setBusy(true)
    try {
      const res = await fetch(`/api/studio/dishes/${dish.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete dish')
      router.push('/studio')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete dish')
      setBusy(false)
    }
  }, [dish.id, router])

  const handleDeleteImage = useCallback(async () => {
    if (!imageToDelete) return
    const image = imageToDelete
    setImageToDelete(null)
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/studio/images/${image.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error((err as { error?: string } | null)?.error ?? 'Failed to delete')
      }
      setImages((prev) => prev.filter((item) => item.id !== image.id))
      void exports.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setBusy(false)
    }
  }, [imageToDelete, exports])

  return (
    <div>
      <StudioLibraryHeader
        dishId={dish.id}
        name={name}
        imageCount={images.length}
        dishCount={dishCount}
        busy={busy}
        dishBlocked={dishBlocked}
        currentImage={currentImage}
        onRename={() => setRenameOpen(true)}
        onNewShot={handleNewShot}
        onDelete={() => void openDelete()}
        onReshootCreated={(image) => {
          setImages((prev) => [...prev, image])
          void exports.refresh()
        }}
      />

      {error ? (
        <p role="alert" className="mb-4 text-sm text-[#ff8a80]">
          {error}
        </p>
      ) : null}

      <StudioLibraryTabs
        tab={tab}
        view={view}
        shotCount={shotCount}
        exportCount={readyExportCount}
        onTab={(next) => {
          setTab(next)
          replaceUrl(next, view)
        }}
        onView={(next) => {
          setView(next)
          replaceUrl('shots', next)
        }}
      />

      {tab === 'shots' && images.length === 0 ? (
        <p className="rounded-[16px] border border-white/[0.1] bg-[#0f1c1f] px-4 py-10 text-center text-sm text-white/55">
          No shots yet. Use + New shot to upload a photo.
        </p>
      ) : null}

      {tab === 'shots' && images.length > 0 && view === 'grid' ? (
        <ul
          className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-5"
          data-testid="studio-shot-grid"
        >
          {chronologicalShots(images).map((image) => (
            <li key={image.id} className="h-full">
              <StudioShotCard
                dishId={dish.id}
                image={image}
                images={images}
                tiles={tilesByImageId.get(image.id)}
                disabled={busy}
                onDelete={setImageToDelete}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {tab === 'shots' && images.length > 0 && view === 'tree' ? (
        <StudioShotTree
          dishId={dish.id}
          images={images}
          tilesByImageId={tilesByImageId}
          disabled={busy}
          onDelete={setImageToDelete}
        />
      ) : null}

      {tab === 'exports' && !exports.loaded ? (
        <p className="text-sm text-white/55">Loading exports…</p>
      ) : null}

      {tab === 'exports' && exports.loaded ? (
        <StudioExportMatrix
          dishName={name}
          images={images}
          shots={exports.shots}
          dishBlocked={dishBlocked}
          onReplaceShotTiles={exports.replaceShotTiles}
        />
      ) : null}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => void handleFileChange(event)}
        disabled={busy}
        aria-label="Upload a new shot"
      />

      <StudioTextModal
        open={renameOpen}
        title="Rename dish"
        label="Dish name"
        initialValue={name}
        confirmText="Save"
        onCancel={() => setRenameOpen(false)}
        onConfirm={(value) => void handleRename(value)}
      />
      <ConfirmDialog
        open={deleteOpen}
        title="Permanently delete this dish?"
        description={`This will permanently delete ${deleteSummary?.imageCount ?? 0} image variant${(deleteSummary?.imageCount ?? 0) === 1 ? '' : 's'} and ${deleteSummary?.exportVariantCount ?? 0} export variant${(deleteSummary?.exportVariantCount ?? 0) === 1 ? '' : 's'}. This cannot be undone.`}
        confirmText="Delete dish"
        variant="danger"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => void handleDelete()}
      />
      <ConfirmDialog
        open={imageToDelete !== null}
        title="Delete this image?"
        description="Permanently delete this image and any export variants made from it. This cannot be undone."
        confirmText="Delete image"
        variant="danger"
        onCancel={() => setImageToDelete(null)}
        onConfirm={() => void handleDeleteImage()}
      />
    </div>
  )
}

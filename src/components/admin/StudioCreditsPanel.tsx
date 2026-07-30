'use client'

import { useCallback, useEffect, useState } from 'react'
import { UXButton } from '@/components/ux'
import { useToast } from '@/components/ui'

interface LedgerRow {
  id: string
  delta: number
  balance_after: number
  reason: string
  created_at: string
  metadata?: { note?: string }
}

interface BetaAccessState {
  enabled: boolean
  grantedAt: string | null
  revokedAt: string | null
  note: string | null
}

interface StudioCreditsPanelProps {
  userId: string
  userEmail: string
  onClose: () => void
}

export function StudioCreditsPanel({ userId, userEmail, onClose }: StudioCreditsPanelProps) {
  const { showToast } = useToast()
  const [balance, setBalance] = useState<number | null>(null)
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [betaAccess, setBetaAccess] = useState<BetaAccessState | null>(null)
  const [loading, setLoading] = useState(true)
  const [delta, setDelta] = useState('25')
  const [note, setNote] = useState('Private beta grant')
  const [betaNote, setBetaNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [accessAction, setAccessAction] = useState<'grant' | 'revoke' | null>(null)
  const [dishIdToClear, setDishIdToClear] = useState('')
  const [clearing, setClearing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [creditsRes, accessRes] = await Promise.all([
        fetch(`/api/admin/studio/credits?userId=${encodeURIComponent(userId)}`),
        fetch(`/api/admin/studio/beta-access?userId=${encodeURIComponent(userId)}`),
      ])
      const [creditsData, accessData] = await Promise.all([
        creditsRes.json(),
        accessRes.json(),
      ])

      if (!creditsRes.ok || !creditsData.success) {
        throw new Error(creditsData.error || 'Failed to load credits')
      }
      if (!accessRes.ok || !accessData.success) {
        throw new Error(accessData.error || 'Failed to load beta access')
      }

      setBalance(accessData.creditBalance)
      setLedger(Array.isArray(creditsData.ledger) ? creditsData.ledger : [])
      setBetaAccess(accessData.access ?? null)
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Credits',
        description: err instanceof Error ? err.message : 'Failed to load',
      })
    } finally {
      setLoading(false)
    }
  }, [showToast, userId])

  useEffect(() => {
    void load()
  }, [load])

  const handleBetaAccess = async (action: 'grant' | 'revoke') => {
    setAccessAction(action)
    try {
      const res = await fetch('/api/admin/studio/beta-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, note: betaNote }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Beta access ${action} failed`)
      }

      showToast({
        type: 'success',
        title: action === 'grant' ? 'Beta access granted' : 'Beta access revoked',
        description: 'Studio access and credits refreshed.',
      })
      await load()
    } catch (err) {
      showToast({
        type: 'error',
        title: action === 'grant' ? 'Grant failed' : 'Revoke failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setAccessAction(null)
    }
  }

  const handleGrant = async () => {
    const parsed = Number.parseInt(delta, 10)
    if (!Number.isInteger(parsed) || parsed === 0) {
      showToast({
        type: 'error',
        title: 'Invalid amount',
        description: 'Enter a non-zero integer (negative to revoke).',
      })
      return
    }
    if (!note.trim()) {
      showToast({ type: 'error', title: 'Note required', description: 'Add a short reason.' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/studio/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, delta: parsed, note }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Grant failed')
      }
      setBalance(data.balance)
      showToast({
        type: 'success',
        title: 'Credits updated',
        description: `New balance: ${data.balance}`,
      })
      await load()
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Grant failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleClearBlock = async () => {
    const id = dishIdToClear.trim()
    if (!id) {
      showToast({ type: 'error', title: 'Dish ID required', description: 'Paste the studio dish UUID.' })
      return
    }
    setClearing(true)
    try {
      const res = await fetch(`/api/admin/studio/dishes/${encodeURIComponent(id)}/clear-generation-block`, {
        method: 'POST',
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Clear failed')
      }
      showToast({
        type: 'success',
        title: 'Dish unblocked',
        description: data.dish?.name ? `Cleared block on “${data.dish.name}”.` : 'Generation block cleared.',
      })
      setDishIdToClear('')
    } catch (err) {
      showToast({
        type: 'error',
        title: 'Unblock failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    } finally {
      setClearing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-label="Studio credits"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Studio credits</h2>
            <p className="text-sm text-gray-600">{userEmail}</p>
            <p className="text-xs text-gray-400">{userId}</p>
          </div>
          <button
            type="button"
            className="text-sm font-medium text-gray-500 hover:text-gray-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : (
          <p className="mb-4 text-sm text-gray-800">
            Balance:{' '}
            <span className="font-semibold" data-testid="admin-studio-credit-balance">
              {balance ?? 0}
            </span>{' '}
            credits
          </p>
        )}

        <div className="mb-6 space-y-3 rounded-md border border-indigo-200 bg-indigo-50/40 p-3">
          <div>
            <h3 className="text-sm font-semibold text-indigo-950">Studio beta access</h3>
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-gray-700">
              <dt className="font-medium">Status</dt>
              <dd>{betaAccess?.enabled ? 'Enabled' : 'Disabled'}</dd>
              <dt className="font-medium">Granted</dt>
              <dd>
                {betaAccess?.grantedAt
                  ? new Date(betaAccess.grantedAt).toLocaleString()
                  : '—'}
              </dd>
              <dt className="font-medium">Revoked</dt>
              <dd>
                {betaAccess?.revokedAt
                  ? new Date(betaAccess.revokedAt).toLocaleString()
                  : '—'}
              </dd>
              <dt className="font-medium">Note</dt>
              <dd className="break-words">{betaAccess?.note || '—'}</dd>
            </dl>
          </div>
          <label className="block text-xs font-medium text-gray-600">
            Beta access note (optional)
            <input
              type="text"
              maxLength={280}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={betaNote}
              onChange={(e) => setBetaNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <UXButton
              variant="primary"
              size="sm"
              loading={accessAction === 'grant'}
              disabled={accessAction !== null && accessAction !== 'grant'}
              onClick={() => void handleBetaAccess('grant')}
            >
              Grant beta access
            </UXButton>
            <UXButton
              variant="warning"
              size="sm"
              loading={accessAction === 'revoke'}
              disabled={accessAction !== null && accessAction !== 'revoke'}
              onClick={() => void handleBetaAccess('revoke')}
            >
              Revoke beta access
            </UXButton>
          </div>
        </div>

        <div className="mb-6 space-y-3 rounded-md border border-gray-200 p-3">
          <label className="block text-xs font-medium text-gray-600">
            Amount (negative to revoke)
            <input
              type="number"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
            />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            Note
            <input
              type="text"
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <UXButton variant="primary" size="sm" loading={saving} onClick={() => void handleGrant()}>
            Apply grant
          </UXButton>
        </div>

        <div className="mb-6 space-y-3 rounded-md border border-amber-200 bg-amber-50/50 p-3">
          <p className="text-xs font-medium text-amber-900">
            Clear dish generation block (after support review)
          </p>
          <input
            type="text"
            placeholder="Dish UUID"
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            value={dishIdToClear}
            onChange={(e) => setDishIdToClear(e.target.value)}
          />
          <UXButton
            variant="outline"
            size="sm"
            loading={clearing}
            onClick={() => void handleClearBlock()}
          >
            Unblock dish
          </UXButton>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-800">Recent ledger</h3>
          {ledger.length === 0 ? (
            <p className="text-xs text-gray-500">No transactions yet.</p>
          ) : (
            <ul className="max-h-48 space-y-2 overflow-y-auto text-xs text-gray-700">
              {ledger.map((row) => (
                <li key={row.id} className="rounded border border-gray-100 px-2 py-1.5">
                  <span className={row.delta > 0 ? 'text-green-700' : 'text-red-700'}>
                    {row.delta > 0 ? '+' : ''}
                    {row.delta}
                  </span>{' '}
                  → {row.balance_after} · {row.reason}
                  {row.metadata?.note ? ` — ${row.metadata.note}` : ''}
                  <div className="text-gray-400">
                    {new Date(row.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

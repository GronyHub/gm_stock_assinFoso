'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

type GridItem = {
  id: number
  name: string
  group: string | null
  soh: number | null
  selling_price: number | null
  cost_price: number | null
}

type Tap = {
  id: number
  item_id: number
  item_name: string
  price: number | string
  staff_name: string
  tapped_at: string
  undone: boolean
  receipt_id?: number
}

function money(n: number) {
  return `₵${n.toFixed(2)}`
}

const PRIORITY_GROUP = 'Printing Press Services'

export default function LiveSalePage({ onClose, initialShowLog, search, groupFilter }: {
  onClose?: () => void; initialShowLog?: boolean; search?: string; groupFilter?: string | null
} = {}) {
  usePresenceReporter('live-tapping a sale')

  const [items, setItems] = useState<GridItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [taps, setTaps] = useState<Tap[]>([])
  const [loadingTaps, setLoadingTaps] = useState(true)
  // Grid vs. log is now picked from the left pane (Sales > Live Sale vs.
  // Sales > Live Sale > Log), which remounts this page with a different
  // initialShowLog rather than toggling in place -- no local state needed.
  const showLog = !!initialShowLog
  const [staffFilter, setStaffFilter] = useState<string | null>(null)
  const [lastTap, setLastTap] = useState<Tap | null>(null)
  const [pendingItemId, setPendingItemId] = useState<number | null>(null)
  const [undoingId, setUndoingId] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/items/all')
      .then((r) => r.json())
      .then((data) => setItems(Array.isArray(data) ? data : []))
      .catch(() => setItems([]))
      .finally(() => setLoadingItems(false))
  }, [])

  useEffect(() => {
    fetch('/api/sales/live-taps')
      .then((r) => r.json())
      .then((data) => setTaps(Array.isArray(data) ? data : []))
      .catch(() => setTaps([]))
      .finally(() => setLoadingTaps(false))
  }, [])

  useEffect(() => {
    if (!lastTap) return
    const t = setTimeout(() => setLastTap(null), 6000)
    return () => clearTimeout(t)
  }, [lastTap])

  const tapCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const t of taps) {
      if (t.undone) continue
      counts.set(t.item_id, (counts.get(t.item_id) ?? 0) + 1)
    }
    return counts
  }, [taps])

  // Search and group filtering come from the green bar above (item/page.tsx's
  // `search`/`group` state) instead of a local search box + chip row -- one
  // filter for the page instead of two that could disagree.
  const gridItems = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase()
    let list = items
    if (groupFilter) list = list.filter((it) => (it.group ?? 'Ungrouped') === groupFilter)
    if (q) list = list.filter((it) => it.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      const ca = tapCounts.get(a.id) ?? 0
      const cb = tapCounts.get(b.id) ?? 0
      if (ca !== cb) return cb - ca
      // Today's actual taps still win (a hot item floats up regardless of
      // group), but before anything's been tapped the list should still
      // open with the group that gets used most -- Printing Press Services.
      const pa = a.group === PRIORITY_GROUP ? 0 : 1
      const pb = b.group === PRIORITY_GROUP ? 0 : 1
      if (pa !== pb) return pa - pb
      return a.name.localeCompare(b.name)
    })
  }, [items, groupFilter, search, tapCounts])

  const staffNames = useMemo(() => {
    const set = new Set<string>()
    for (const t of taps) set.add(t.staff_name)
    return Array.from(set).sort()
  }, [taps])

  const visibleTaps = useMemo(() => {
    if (!staffFilter) return taps
    return taps.filter((t) => t.staff_name === staffFilter)
  }, [taps, staffFilter])

  async function tap(item: GridItem) {
    if (pendingItemId) return
    setPendingItemId(item.id)
    try {
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Could not record tap')
        return
      }
      setTaps((prev) => [data.tap, ...prev])
      setLastTap(data.tap)
    } catch {
      alert('Could not record tap')
    } finally {
      setPendingItemId(null)
    }
  }

  async function undo(tapId: number) {
    if (undoingId) return
    setUndoingId(tapId)
    try {
      const res = await fetch(`/api/sales/live-tap/${tapId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Could not undo tap')
        return
      }
      setTaps((prev) => prev.map((t) => (t.id === tapId ? { ...t, undone: true } : t)))
      setLastTap((prev) => (prev && prev.id === tapId ? null : prev))
    } catch {
      alert('Could not undo tap')
    } finally {
      setUndoingId(null)
    }
  }

  return (
    <div className="relative pb-24">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <h2 className="min-w-0 text-xs font-bold leading-tight truncate">
          ⚡ Live Sale <span className="font-normal text-gray-400">· tap to record</span>
        </h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-2 py-0.5 rounded-lg text-xs font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300"
          >
            ×
          </button>
        )}
      </div>

      {showLog ? (
        <div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button
              type="button"
              onClick={() => setStaffFilter(null)}
              className={`px-2 py-1 rounded-full text-xs font-semibold border ${!staffFilter ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
            >
              All staff
            </button>
            {staffNames.map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setStaffFilter(name)}
                className={`px-2 py-1 rounded-full text-xs font-semibold border ${staffFilter === name ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {name}
              </button>
            ))}
          </div>

          {loadingTaps ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : visibleTaps.length === 0 ? (
            <p className="text-sm text-gray-400">No taps yet today.</p>
          ) : (
            <div className="space-y-1">
              {visibleTaps.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm ${t.undone ? 'bg-gray-50 border-gray-200 text-gray-400' : 'bg-white border-gray-200'}`}
                >
                  <div className={`min-w-0 ${t.undone ? 'line-through' : ''}`}>
                    <div className="font-semibold truncate">{t.item_name} · {money(Number(t.price))}</div>
                    <div className="text-xs text-gray-500">
                      {t.staff_name} · {new Date(t.tapped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                  {!t.undone && (
                    <button
                      type="button"
                      onClick={() => undo(t.id)}
                      disabled={undoingId === t.id}
                      className="shrink-0 px-2 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                    >
                      Undo
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {loadingItems ? (
            <p className="text-sm text-gray-400">Loading items…</p>
          ) : (
            <div>
              {gridItems.map((it) => {
                const count = tapCounts.get(it.id) ?? 0
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => tap(it)}
                    disabled={pendingItemId === it.id}
                    className="w-full flex items-center gap-1 text-left px-2 py-1.5 border-b border-gray-50 bg-white hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50"
                  >
                    <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-900 leading-tight" style={{ wordBreak: 'break-word' }}>
                      {it.name} <span className="text-blue-600 font-bold">({money(Number(it.selling_price) || 0)})</span>
                    </p>
                    {count > 0 && (
                      <span className="shrink-0 min-w-[0.9rem] h-[0.9rem] px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
              {gridItems.length === 0 && <p className="text-[10px] text-gray-400 text-center py-6">No items match.</p>}
            </div>
          )}
        </div>
      )}

      {lastTap && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-green-600 text-white shadow-lg text-sm font-semibold">
          <span>✓ {lastTap.item_name} · {money(Number(lastTap.price))}</span>
          <button
            type="button"
            onClick={() => undo(lastTap.id)}
            disabled={undoingId === lastTap.id}
            className="px-2 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-xs font-bold disabled:opacity-50"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  )
}

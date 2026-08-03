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
const ORDER_KEY = 'liveSaleOrder'

function defaultSort(list: GridItem[], tapCounts: Map<number, number>) {
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
}

// Staff-arranged order wins over the automatic sort for whichever items
// have been explicitly placed -- anything not yet touched just falls in
// afterwards using the normal hot-item/group/alphabetical order, so a
// newly stocked item still shows up without needing to be arranged first.
function applyManualOrder(list: GridItem[], order: number[]) {
  if (order.length === 0) return list
  const rank = new Map(order.map((id, i) => [id, i]))
  const ranked = list.filter((it) => rank.has(it.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!)
  const rest = list.filter((it) => !rank.has(it.id))
  return [...ranked, ...rest]
}

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
  const [arranging, setArranging] = useState(false)
  // Persisted on this device (not the server) -- it's a per-terminal
  // convenience for whoever's tapping on this phone, not shared business
  // data, so a plain localStorage array of item ids is enough.
  const [manualOrder, setManualOrder] = useState<number[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = window.localStorage.getItem(ORDER_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  })

  function persistOrder(order: number[]) {
    setManualOrder(order)
    try {
      window.localStorage.setItem(ORDER_KEY, JSON.stringify(order))
    } catch {
      // best-effort -- a full/unavailable localStorage just means the
      // arrangement won't stick, not that tapping should break
    }
  }

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

  // The full arranged order (unfiltered) is what move/top actions operate
  // on and persist, so a move made while a group/search filter is active
  // still lands in the right place once the filter is cleared.
  const fullOrderedItems = useMemo(
    () => applyManualOrder(defaultSort(items, tapCounts), manualOrder),
    [items, tapCounts, manualOrder]
  )

  // Search and group filtering come from the green bar above (item/page.tsx's
  // `search`/`group` state) instead of a local search box + chip row -- one
  // filter for the page instead of two that could disagree.
  const gridItems = useMemo(() => {
    const q = (search ?? '').trim().toLowerCase()
    let list = fullOrderedItems
    if (groupFilter) list = list.filter((it) => (it.group ?? 'Ungrouped') === groupFilter)
    if (q) list = list.filter((it) => it.name.toLowerCase().includes(q))
    return list
  }, [fullOrderedItems, groupFilter, search])

  function moveToTop(id: number) {
    persistOrder([id, ...fullOrderedItems.filter((it) => it.id !== id).map((it) => it.id)])
  }

  function moveBy(id: number, delta: number) {
    const ids = fullOrderedItems.map((it) => it.id)
    const i = ids.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= ids.length) return
    ;[ids[i], ids[j]] = [ids[j], ids[i]]
    persistOrder(ids)
  }

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
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1 border-b border-gray-200">
        <h2 className="min-w-0 text-xs font-bold leading-tight truncate">
          ⚡ Live Sale <span className="font-normal text-gray-400">· tap to record</span>
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          {!showLog && (
            <button
              type="button"
              onClick={() => setArranging((v) => !v)}
              title="Arrange the item list"
              className={`px-2 py-0.5 rounded-lg text-xs font-semibold border transition
                ${arranging ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-300'}`}
            >
              {arranging ? 'Done' : '↕ Arrange'}
            </button>
          )}
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
      </div>
      {showLog ? (
        <div className="px-2 pt-2">
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
              {gridItems.map((it, idx) => {
                const count = tapCounts.get(it.id) ?? 0
                const number = (
                  <span className="shrink-0 w-4 text-right text-[9px] font-bold text-gray-400">{idx + 1}</span>
                )
                const label = (
                  <p className="flex-1 min-w-0 text-[10px] font-semibold text-gray-900 leading-tight" style={{ wordBreak: 'break-word' }}>
                    {it.name} <span className="text-blue-600 font-bold">({money(Number(it.selling_price) || 0)})</span>
                  </p>
                )

                if (arranging) {
                  return (
                    <div
                      key={it.id}
                      className="w-full flex items-center gap-1 px-2 py-1.5 border-b border-gray-50 bg-white"
                    >
                      {number}
                      {label}
                      <button
                        type="button"
                        onClick={() => moveBy(it.id, -1)}
                        disabled={idx === 0}
                        title="Move up"
                        className="shrink-0 w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveBy(it.id, 1)}
                        disabled={idx === gridItems.length - 1}
                        title="Move down"
                        className="shrink-0 w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => moveToTop(it.id)}
                        disabled={idx === 0}
                        title="Move to top"
                        className="shrink-0 px-1.5 h-5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"
                      >
                        ⤒ Top
                      </button>
                    </div>
                  )
                }

                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => tap(it)}
                    disabled={pendingItemId === it.id}
                    className="w-full flex items-center gap-1 text-left px-2 py-1.5 border-b border-gray-50 bg-white hover:bg-blue-50 active:bg-blue-100 transition disabled:opacity-50"
                  >
                    {number}
                    {label}
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

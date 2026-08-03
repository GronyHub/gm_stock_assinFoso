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

export default function LiveSalePage({ onClose }: { onClose?: () => void } = {}) {
  usePresenceReporter('live-tapping a sale')

  const [items, setItems] = useState<GridItem[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [search, setSearch] = useState('')
  const [activeGroup, setActiveGroup] = useState<string | null>(null)
  const [taps, setTaps] = useState<Tap[]>([])
  const [loadingTaps, setLoadingTaps] = useState(true)
  const [showLog, setShowLog] = useState(false)
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

  const groups = useMemo(() => {
    const set = new Set<string>()
    for (const it of items) {
      if (it.group) set.add(it.group)
    }
    return Array.from(set).sort()
  }, [items])

  const gridItems = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = items
    if (activeGroup) list = list.filter((it) => it.group === activeGroup)
    if (q) list = list.filter((it) => it.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      const ca = tapCounts.get(a.id) ?? 0
      const cb = tapCounts.get(b.id) ?? 0
      if (ca !== cb) return cb - ca
      return a.name.localeCompare(b.name)
    })
  }, [items, activeGroup, search, tapCounts])

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
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="text-lg font-bold">⚡ Live Sale</h2>
          <p className="text-xs text-gray-500">Walk-in only · every tap saves instantly to today&apos;s WIC receipt</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowLog((v) => !v)}
            className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300"
          >
            📋 Log{taps.filter((t) => !t.undone).length > 0 ? ` (${taps.filter((t) => !t.undone).length})` : ''}
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300"
            >
              ×
            </button>
          )}
        </div>
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
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm"
            />
          </div>
          {groups.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                type="button"
                onClick={() => setActiveGroup(null)}
                className={`px-2 py-1 rounded-full text-xs font-semibold border ${!activeGroup ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                All
              </button>
              {groups.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setActiveGroup(g)}
                  className={`px-2 py-1 rounded-full text-xs font-semibold border ${activeGroup === g ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          )}

          {loadingItems ? (
            <p className="text-sm text-gray-400">Loading items…</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {gridItems.map((it) => {
                const count = tapCounts.get(it.id) ?? 0
                return (
                  <button
                    key={it.id}
                    type="button"
                    onClick={() => tap(it)}
                    disabled={pendingItemId === it.id}
                    className="relative text-left px-3 py-4 rounded-xl border border-gray-300 bg-white shadow-sm hover:border-blue-400 active:scale-95 transition disabled:opacity-50"
                  >
                    {count > 0 && (
                      <span className="absolute top-1.5 right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                        {count}
                      </span>
                    )}
                    <div className="text-sm font-semibold pr-6 line-clamp-2">{it.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{money(Number(it.selling_price) || 0)}</div>
                  </button>
                )
              })}
              {gridItems.length === 0 && <p className="col-span-full text-sm text-gray-400">No items match.</p>}
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

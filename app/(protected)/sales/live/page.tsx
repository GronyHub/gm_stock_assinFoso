'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from '../../item/_components/columnPrefs'
import PageLawsList from '../../item/_components/PageLawsList'
import LawsToggleBar from '../../item/_components/LawsToggleBar'
import { useLawsPanel } from '../../item/_components/useLawsPanel'

type GridItem = {
  id: number
  name: string
  group: string | null
  soh: number | null
  selling_price: number | null
  cost_price: number | null
  product_type: string | null
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
  quantity: number
}

function money(n: number) {
  return `₵${n.toFixed(2)}`
}

// Same trailing-.00 trim as compactAmount below, but keeps the ₵ sign --
// used for the item row's own selling price, which reads fine short (e.g.
// "₵50") without needing money()'s always-2dp precision.
function moneyCompact(n: number) {
  return `₵${Math.round(n * 100) / 100}`
}

// Preset-button labels only -- no ₵ sign (obvious from context, sitting
// right under the item's own priced name) and no trailing .00, so more
// buttons fit on one line. Rounds to 2dp first to clear floating-point
// noise (e.g. 3 x 0.7), then lets JS's own number->string conversion drop
// whatever trailing zeros/decimal point aren't needed.
function compactAmount(n: number) {
  return `${Math.round(n * 100) / 100}`
}

const PRIORITY_GROUP = 'Printing Press Services'
const ORDER_KEY = 'liveSaleOrder'

// The buttons record these quantities same as before -- goods are usually
// bought a handful at a time, while photo/print services (passport photos
// being the classic case) get ordered in the batch sizes below -- but they're
// now LABELED by the total price that quantity comes to, not the bare
// quantity number, since that's what a customer actually hands over and
// what staff are matching against. 1 is always in the list (added to
// SERVICE_QTY, already there for goods) so the item's own single-unit
// selling price always appears as one of the buttons.
const GOODS_QTY = [1, 2, 3, 4, 5]
const SERVICE_QTY = [1, 10, 12, 15, 18, 20]
function qtyPresetsFor(item: GridItem) {
  return item.product_type === 'service' ? SERVICE_QTY : GOODS_QTY
}

// Log table columns -- same show/hide/reorder/resize picker every other
// table in the app uses (see columnPrefs.tsx), so staff can drop columns
// they don't care about and widen the ones they do instead of being stuck
// with a fixed layout.
type LogColKey = 'item' | 'time' | 'sp' | 'qty' | 'total' | 'staff'
const LOG_COLUMNS: ColumnDef<LogColKey>[] = [
  { key: 'item',  label: 'Item' },
  { key: 'time',  label: 'Time' },
  { key: 'sp',    label: 'SP' },
  { key: 'qty',   label: 'Qty' },
  { key: 'total', label: 'Total' },
  { key: 'staff', label: 'Staff' },
]
const LOG_COL_DEFAULTS: Record<string, number> = { item: 160, time: 70, sp: 56, qty: 44, total: 70, staff: 90, actions: 56 }

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
  const lawsPanel = useLawsPanel('showLiveSaleLaws')
  const [staffFilter, setStaffFilter] = useState<string | null>(null)
  const [lastTap, setLastTap] = useState<Tap | null>(null)
  const [pendingItemId, setPendingItemId] = useState<number | null>(null)
  // Which specific preset was tapped -- pendingItemId alone can't tell the
  // pressed button apart from its siblings on the same row, which is why
  // all of them dimmed together instead of just the one actually pressed.
  const [pendingQty, setPendingQty] = useState<number | null>(null)
  const [undoingId, setUndoingId] = useState<number | null>(null)
  const [arranging, setArranging] = useState(false)
  // Large-screen mode -- overlays the whole viewport (fixed inset-0, above
  // everything else) instead of sitting inside the normal pane/content
  // layout, so the grid gets the full screen to tap into instead of
  // sharing it with the left pane. A plain CSS overlay rather than the
  // real Fullscreen API -- iOS Safari on phones doesn't support
  // requestFullscreen() on ordinary elements (only <video>), and this is
  // used mostly on phones, so the API route would just silently fail for
  // a lot of staff. Not persisted -- always starts normal-sized so
  // reopening Live Sale doesn't strand someone in an overlay they don't
  // remember turning on.
  const [expanded, setExpanded] = useState(false)
  const logColPrefs = useColumnPrefs<LogColKey>('liveSaleLog', LOG_COLUMNS)
  // Shared via /api/app-settings (owner-level to write, everyone reads),
  // not per-device localStorage -- an arrangement the owner sets up should
  // show the same way on every staff member's own phone, not just the one
  // that set it (see the Shared Settings policy).
  const [manualOrder, setManualOrder] = useState<number[]>([])
  const [manualAmounts, setManualAmounts] = useState<Record<number, string>>({})
  useEffect(() => {
    fetch(`/api/app-settings?key=${ORDER_KEY}`)
      .then(r => r.ok ? r.json() : { value: null })
      .then((d: { value: unknown }) => { if (Array.isArray(d?.value)) setManualOrder(d.value as number[]) })
      .catch(() => {})
  }, [])

  function persistOrder(order: number[]) {
    setManualOrder(order)
    fetch('/api/app-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ORDER_KEY, value: order }),
    }).catch(() => {})
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

  // Sum of units tapped today, not number of tap events -- a single "20"
  // tap for a passport-photo batch should outweigh five single "1" taps
  // of something else by the same margin it does in real demand.
  const tapCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const t of taps) {
      if (t.undone) continue
      counts.set(t.item_id, (counts.get(t.item_id) ?? 0) + (Number(t.quantity) || 1))
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

  async function tap(item: GridItem, quantity: number) {
    if (pendingItemId) return
    setPendingItemId(item.id)
    setPendingQty(quantity)
    try {
      const res = await fetch('/api/sales/live-tap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, quantity }),
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
      setPendingQty(null)
    }
  }

  function submitManualAmount(item: GridItem) {
    const amount = manualAmounts[item.id]?.trim()
    if (!amount) return
    const qty = Number(amount)
    if (isNaN(qty) || qty <= 0) {
      alert('Please enter a valid amount')
      return
    }
    setManualAmounts((prev) => ({ ...prev, [item.id]: '' }))
    tap(item, qty)
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
    <div className={expanded
      ? 'fixed inset-0 z-50 bg-white overflow-y-auto pb-24'
      : 'relative pb-24'}>
      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-1 border-b border-gray-200">
        <h2 className="min-w-0 text-xs font-bold leading-tight truncate">
          ⚡ Live Sale <span className="font-normal text-gray-400">· tap to record</span>
        </h2>
        <div className="flex items-center gap-1.5 shrink-0">
          <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
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
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Exit large screen' : 'Large screen'}
            className={`shrink-0 w-6 h-6 rounded-lg text-xs font-semibold border flex items-center justify-center transition
              ${expanded ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border-gray-300'}`}
          >
            {expanded ? '⤡' : '⤢'}
          </button>
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
      {lawsPanel.show && (
        <div className="border-b border-gray-200 bg-white px-2 py-1.5">
          <PageLawsList
            scopeKey={showLog ? 'Sale Log' : 'Live Sale'}
            isItemsLaws={true}
            onChange={lawsPanel.bumpRefresh}
            openForm={lawsPanel.openForm}
            setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags}
            setHideZeroFlags={lawsPanel.setHideZeroFlags}
            activeFilters={lawsPanel.activeFilters}
          />
        </div>
      )}
      {showLog ? (
        <div className="px-2 pt-2">
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
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
            {/* ml-auto pushes this to the row's right edge -- anchored any
                closer to the left, the dropdown (which opens from its own
                right edge, extending leftward) ran out of room on a phone
                and got clipped by the left pane. */}
            <div className="ml-auto">
              <ColumnsPickerButton prefs={logColPrefs} />
            </div>
          </div>

          {loadingTaps ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : visibleTaps.length === 0 ? (
            <p className="text-sm text-gray-400">No taps yet today.</p>
          ) : (
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="border-collapse text-[10px]" style={{
                tableLayout: 'fixed',
                width: logColPrefs.shownColumns.reduce((s, c) => s + logColPrefs.getWidth(c.key, LOG_COL_DEFAULTS[c.key] ?? 80), 0)
                  + logColPrefs.getWidth('actions', LOG_COL_DEFAULTS.actions),
              }}>
                <colgroup>
                  {logColPrefs.shownColumns.map((c) => <col key={c.key} style={{ width: logColPrefs.getWidth(c.key, LOG_COL_DEFAULTS[c.key] ?? 80) }} />)}
                  <col style={{ width: logColPrefs.getWidth('actions', LOG_COL_DEFAULTS.actions) }} />
                </colgroup>
                <thead>
                  <tr className="bg-gray-50">
                    {logColPrefs.shownColumns.map((c) => (
                      <ResizableTh key={c.key} align={c.key === 'sp' || c.key === 'qty' || c.key === 'total' ? 'right' : 'left'}
                        className="text-[9px]"
                        onResize={(d) => logColPrefs.resizeWidth(c.key, d, LOG_COL_DEFAULTS[c.key] ?? 80)}
                        onReset={() => logColPrefs.resetWidth(c.key)}>
                        {c.label}
                      </ResizableTh>
                    ))}
                    <ResizableTh noDivider className="text-[9px]"
                      onResize={(d) => logColPrefs.resizeWidth('actions', d, LOG_COL_DEFAULTS.actions)}
                      onReset={() => logColPrefs.resetWidth('actions')} />
                  </tr>
                </thead>
                <tbody>
                  {visibleTaps.map((t) => (
                    <tr
                      key={t.id}
                      className={`border-b border-gray-50 last:border-0 ${t.undone ? 'bg-gray-50 text-gray-400 line-through' : 'bg-white'}`}
                    >
                      {logColPrefs.shownColumns.map((c) => (
                        <td key={c.key}
                          className={`px-2 py-1 overflow-hidden text-ellipsis whitespace-nowrap ${c.key === 'item' ? 'font-semibold' : ''} ${c.key === 'sp' || c.key === 'qty' || c.key === 'total' ? 'text-right' : ''} ${c.key === 'total' ? 'font-bold text-blue-600' : ''}`}
                        >
                          {c.key === 'item' && t.item_name}
                          {c.key === 'time' && new Date(t.tapped_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          {c.key === 'sp' && money(Number(t.price))}
                          {c.key === 'qty' && t.quantity}
                          {c.key === 'total' && money(Number(t.price) * t.quantity)}
                          {c.key === 'staff' && t.staff_name}
                        </td>
                      ))}
                      <td className="px-2 py-1 whitespace-nowrap">
                        {!t.undone && (
                          <button
                            type="button"
                            onClick={() => undo(t.id)}
                            disabled={undoingId === t.id}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 disabled:opacity-50"
                          >
                            Undo
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                    {it.name} <span className="text-blue-600 font-bold">({moneyCompact(Number(it.selling_price) || 0)})</span>
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

                const pending = pendingItemId === it.id
                return (
                  <div key={it.id} className="w-full px-2 py-1.5 border-b border-gray-50 bg-white">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {number}
                      <div className="flex items-center gap-1">
                        {label}
                        {count > 0 && (
                          <span className="shrink-0 min-w-[0.9rem] h-[0.9rem] px-0.5 rounded-full bg-blue-600 text-white text-[8px] font-bold flex items-center justify-center">
                            {count}
                          </span>
                        )}
                      </div>
                      {/* Buttons follow item names, flowing inline and wrapping
                          naturally to fill available space neatly. The pressed
                          one turns solid while its request is in flight so it
                          reads as "that's the one I hit," instead of every
                          button in the row dimming the same way together. */}
                      <div className="flex flex-wrap items-center gap-1">
                        {qtyPresetsFor(it).map((q) => {
                          const total = (Number(it.selling_price) || 0) * q
                          const pressed = pending && pendingQty === q
                          return (
                            <button
                              key={q}
                              type="button"
                              onClick={() => tap(it, q)}
                              disabled={pending}
                              title={`${q} unit${q > 1 ? 's' : ''} · ${money(total)}`}
                              className={pressed
                                ? 'min-w-[2rem] h-7 px-1.5 rounded-lg bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center transition disabled:opacity-100'
                                : 'min-w-[2rem] h-7 px-1.5 rounded-lg bg-blue-50 text-blue-700 text-[11px] font-bold flex items-center justify-center hover:bg-blue-100 active:bg-blue-200 active:scale-95 transition disabled:opacity-40'}
                            >
                              {compactAmount(total)}
                            </button>
                          )
                        })}
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="+"
                          value={manualAmounts[it.id] ?? ''}
                          onChange={(e) => setManualAmounts((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              submitManualAmount(it)
                            }
                          }}
                          disabled={pending}
                          className="w-8 h-7 px-0.5 rounded-lg bg-gray-100 text-gray-700 text-[10px] font-bold border border-gray-300 text-center focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-40 transition"
                        />
                        {manualAmounts[it.id] && (
                          <button
                            type="button"
                            onClick={() => submitManualAmount(it)}
                            disabled={pending}
                            className="w-6 h-7 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold flex items-center justify-center transition disabled:opacity-40"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {gridItems.length === 0 && <p className="text-[10px] text-gray-400 text-center py-6">No items match.</p>}
            </div>
          )}
        </div>
      )}

      {lastTap && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full bg-green-600 text-white shadow-lg text-sm font-semibold">
          <span>✓ {lastTap.item_name} × {lastTap.quantity} · {money(Number(lastTap.price) * lastTap.quantity)}</span>
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

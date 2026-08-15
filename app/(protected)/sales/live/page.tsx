'use client'

import { useEffect, useMemo, useState, useRef, Fragment } from 'react'
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
// selling price always appears as one of the buttons. Kept minimal so
// item name + buttons fit on one line; users can customize via long-press.
const GOODS_QTY = [1, 2, 3]
const SERVICE_QTY = [1, 10, 15]
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

export default function LiveSalePage({ onClose, initialShowLog, search, groupFilter, lawsPanel: propsLawsPanel, expanded: propsExpanded, setExpanded: propsSetExpanded, hideTopControls }: {
  onClose?: () => void; initialShowLog?: boolean; search?: string; groupFilter?: string | null; lawsPanel?: ReturnType<typeof useLawsPanel>; expanded?: boolean; setExpanded?: (v: boolean | ((prev: boolean) => boolean)) => void; hideTopControls?: boolean
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
  const localLawsPanel = useLawsPanel('showLiveSaleLaws')
  const lawsPanel = propsLawsPanel ?? localLawsPanel
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
  const [localExpanded, setLocalExpanded] = useState(false)
  const expanded = propsExpanded ?? localExpanded
  const setExpanded = propsSetExpanded ?? setLocalExpanded
  const logColPrefs = useColumnPrefs<LogColKey>('liveSaleLog', LOG_COLUMNS)
  // Shared via /api/app-settings (owner-level to write, everyone reads),
  // not per-device localStorage -- an arrangement the owner sets up should
  // show the same way on every staff member's own phone, not just the one
  // that set it (see the Shared Settings policy).
  const [manualOrder, setManualOrder] = useState<number[]>([])
  const [manualAmounts, setManualAmounts] = useState<Record<number, string>>({})
  const [positionInputs, setPositionInputs] = useState<Record<number, string>>({})
  const [itemPresets, setItemPresets] = useState<Record<number, number[]>>({})
  const [editingButton, setEditingButton] = useState<{ itemId: number; index: number } | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [quickArrangeItemId, setQuickArrangeItemId] = useState<number | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [itemsPerPage, setItemsPerPage] = useState(5)
  const longPressTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const touchStartXRef = useRef(0)
  const itemsContainerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    fetch(`/api/app-settings?key=${ORDER_KEY}`)
      .then(r => r.ok ? r.json() : { value: null })
      .then((d: { value: unknown }) => { if (Array.isArray(d?.value)) setManualOrder(d.value as number[]) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const saved = localStorage.getItem('liveSaleItemPresets')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (typeof parsed === 'object') setItemPresets(parsed)
      } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('liveSaleItemPresets', JSON.stringify(itemPresets))
  }, [itemPresets])

  // Calculate items per page based on container height
  useEffect(() => {
    const calculateItemsPerPage = () => {
      // Calculate available viewport height for items
      // Subtract: top bar (~50px) + controls (~40px) + pagination (~35px) + log table (~150px)
      const reservedHeight = 275
      const availableHeight = window.innerHeight - reservedHeight
      // Estimate: each item row is roughly 40-45px (compact spacing)
      const estimatedItemHeight = 42
      const calculated = Math.max(5, Math.floor(availableHeight / estimatedItemHeight))
      setItemsPerPage(calculated)
    }
    calculateItemsPerPage()
    window.addEventListener('resize', calculateItemsPerPage)
    return () => window.removeEventListener('resize', calculateItemsPerPage)
  }, [])

  // Handle swipe gestures
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX || 0
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0]?.clientX || 0
    const delta = touchStartXRef.current - touchEndX
    const threshold = 50 // Minimum swipe distance
    const totalPages = Math.ceil(gridItems.length / itemsPerPage)

    if (Math.abs(delta) > threshold) {
      if (delta > 0 && currentPage < totalPages - 1) {
        // Swiped left, go to next page
        setCurrentPage(currentPage + 1)
      } else if (delta < 0 && currentPage > 0) {
        // Swiped right, go to previous page
        setCurrentPage(currentPage - 1)
      }
    }
  }

  function persistOrder(order: number[]) {
    setManualOrder(order)
    fetch('/api/app-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: ORDER_KEY, value: order }),
    }).catch(() => {
      console.error('Failed to save arrangement - only owner can arrange items')
    })
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

  // Reset to first page when items change
  useEffect(() => {
    setCurrentPage(0)
  }, [gridItems.length])

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

  // Group taps by date for log display
  const tapsByDate = useMemo(() => {
    const grouped = new Map<string, typeof taps>()
    for (const tap of visibleTaps) {
      const date = tap.tapped_at.split('T')[0]
      if (!grouped.has(date)) grouped.set(date, [])
      grouped.get(date)!.push(tap)
    }
    // Sort dates in descending order (today first)
    return Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [visibleTaps])

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

  function getPresetsForItem(item: GridItem) {
    if (itemPresets[item.id]) return itemPresets[item.id]
    return item.product_type === 'service' ? SERVICE_QTY : GOODS_QTY
  }

  function setPresetsForItem(itemId: number, presets: number[]) {
    setItemPresets((prev) => ({ ...prev, [itemId]: presets }))
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

  function moveToPosition(itemId: number, targetPos: number) {
    const ids = fullOrderedItems.map((it) => it.id)
    const currentIdx = ids.indexOf(itemId)
    if (currentIdx < 0) return
    // Convert 1-based position to 0-based index
    const newIdx = Math.max(0, Math.min(ids.length - 1, targetPos - 1))
    if (newIdx === currentIdx) return
    // Remove item and insert at new position
    const newIds = ids.filter((id) => id !== itemId)
    newIds.splice(newIdx, 0, itemId)
    persistOrder(newIds)
    setPositionInputs((prev) => ({ ...prev, [itemId]: '' }))
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
            <button
              type="button"
              onClick={async () => {
                for (const [date] of tapsByDate) {
                  try {
                    await fetch('/api/sales/live-sale', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ date }),
                    })
                  } catch (e) {
                    console.error(`Failed to create sale for ${date}:`, e)
                  }
                }
                // Refresh the taps
                const res = await fetch('/api/sales/live-taps')
                const data = await res.json()
                setTaps(Array.isArray(data) ? data : [])
              }}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 border border-green-700"
            >
              Create Daily Sales
            </button>
            <div className="ml-auto">
              <ColumnsPickerButton prefs={logColPrefs} />
            </div>
          </div>

          {loadingTaps ? (
            <p className="text-sm text-gray-400">Loading…</p>
          ) : visibleTaps.length === 0 ? (
            <p className="text-sm text-gray-400">No sales recorded.</p>
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
                        className={`text-[9px] ${c.key === 'item' ? 'sticky left-0 bg-gray-50 z-10' : ''}`}
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
                  {tapsByDate.map(([date, dayTaps]) => {
                    const regularTaps = dayTaps.filter(t => t.item_name !== 'Sale')
                    const saleTap = dayTaps.find(t => t.item_name === 'Sale')
                    const dayTotal = regularTaps.reduce((sum, t) => sum + (t.undone ? 0 : Number(t.price) * t.quantity), 0)
                    const dateObj = new Date(date)
                    const dateLabel = dateObj.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
                    return (
                      <Fragment key={date}>
                        <tr className="bg-green-50 border-b border-green-200">
                          <td className={`px-2 py-2 text-[9px] font-bold text-green-800 ${logColPrefs.shownColumns[0]?.key === 'item' ? 'sticky left-0 bg-green-50 z-10' : ''}`} colSpan={logColPrefs.shownColumns.length}>
                            📅 {dateLabel}
                          </td>
                        </tr>
                        {regularTaps.map((t) => (
                          <tr
                            key={t.id}
                            className={`border-b border-gray-50 ${t.undone ? 'bg-gray-50 text-gray-400 line-through' : 'bg-white'}`}
                          >
                            {logColPrefs.shownColumns.map((c) => (
                              <td key={c.key}
                                className={`px-2 py-1 overflow-hidden text-ellipsis whitespace-nowrap ${c.key === 'item' ? 'font-semibold sticky left-0 bg-white z-10' : ''} ${c.key === 'sp' || c.key === 'qty' || c.key === 'total' ? 'text-right' : ''} ${c.key === 'total' ? 'font-bold text-blue-600' : ''}`}
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
                        {saleTap && (
                          <tr className="bg-green-100 border-b border-green-300 font-bold">
                            {logColPrefs.shownColumns.map((c) => (
                              <td key={c.key}
                                className={`px-2 py-1.5 text-[9px] font-bold text-green-800 ${c.key === 'item' ? 'sticky left-0 bg-green-100 z-10' : ''} ${c.key === 'sp' || c.key === 'qty' || c.key === 'total' ? 'text-right' : ''}`}
                              >
                                {c.key === 'item' && '💰 Sale'}
                                {c.key === 'total' && money(dayTotal)}
                              </td>
                            ))}
                            <td />
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
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
              {/* Items container with swipe support */}
              <div
                ref={itemsContainerRef}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                className="overflow-hidden"
              >
                {(() => {
                  const startIdx = currentPage * itemsPerPage
                  const endIdx = startIdx + itemsPerPage
                  const pageItems = gridItems.slice(startIdx, endIdx)
                  return pageItems.map((it, pageIdx) => {
                    const globalIdx = startIdx + pageIdx
                    const count = tapCounts.get(it.id) ?? 0
                    const number = (
                      <span className="shrink-0 w-4 text-right text-[9px] font-bold text-gray-400">{globalIdx + 1}</span>
                    )
                const label = (
                  <p
                    className="text-[10px] font-semibold text-gray-900 leading-tight"
                    style={{ wordBreak: 'break-word' }}
                    onPointerDown={() => {
                      longPressTimeoutRef.current = setTimeout(() => {
                        setQuickArrangeItemId(it.id)
                        longPressTimeoutRef.current = null
                      }, 500)
                    }}
                    onPointerUp={() => {
                      if (longPressTimeoutRef.current) {
                        clearTimeout(longPressTimeoutRef.current)
                        longPressTimeoutRef.current = null
                      }
                    }}
                    onPointerLeave={() => {
                      if (longPressTimeoutRef.current) {
                        clearTimeout(longPressTimeoutRef.current)
                        longPressTimeoutRef.current = null
                      }
                    }}
                  >
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
                        onClick={() => {
                          if (confirm(`Move "${it.name}" up?`)) {
                            moveBy(it.id, -1)
                          }
                        }}
                        disabled={globalIdx === 0}
                        title="Move up"
                        className="shrink-0 w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Move "${it.name}" down?`)) {
                            moveBy(it.id, 1)
                          }
                        }}
                        disabled={globalIdx === gridItems.length - 1}
                        title="Move down"
                        className="shrink-0 w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`Move "${it.name}" to top?`)) {
                            moveToTop(it.id)
                          }
                        }}
                        disabled={globalIdx === 0}
                        title="Move to top"
                        className="shrink-0 px-1.5 h-5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"
                      >
                        ⤒ Top
                      </button>
                      <div className="ml-auto flex items-center gap-1">
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="pos"
                          min="1"
                          max={fullOrderedItems.length}
                          value={positionInputs[it.id] ?? ''}
                          onChange={(e) => setPositionInputs((prev) => ({ ...prev, [it.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              const pos = Number(positionInputs[it.id])
                              if (!isNaN(pos)) moveToPosition(it.id, pos)
                            }
                          }}
                          className="w-12 h-5 px-0.5 rounded bg-white text-gray-700 text-[9px] font-bold border border-gray-300 text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                        />
                        {positionInputs[it.id] && (
                          <button
                            type="button"
                            onClick={() => {
                              const pos = Number(positionInputs[it.id])
                              if (!isNaN(pos)) moveToPosition(it.id, pos)
                            }}
                            className="w-5 h-5 rounded bg-green-600 hover:bg-green-700 text-white text-[8px] font-bold flex items-center justify-center"
                          >
                            ✓
                          </button>
                        )}
                      </div>
                    </div>
                  )
                }

                const pending = pendingItemId === it.id
                const bgColor = globalIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                return (
                  <div key={it.id} className={`w-full px-0 pr-2 py-1.5 border-b border-gray-200 ${bgColor}`}>
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
                      {/* Preset buttons follow item name, wrapping with outer flex */}
                      {getPresetsForItem(it).map((q, qIdx) => {
                          const total = (Number(it.selling_price) || 0) * q
                          const pressed = pending && pendingQty === q
                          const isEditing = editingButton?.itemId === it.id && editingButton?.index === qIdx
                          const presets = getPresetsForItem(it)

                          if (isEditing) {
                            return (
                              <div key={`edit-${qIdx}`} className="flex items-center gap-0.5">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  autoFocus
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault()
                                      const newVal = Number(editingValue)
                                      if (!isNaN(newVal) && newVal > 0) {
                                        const newPresets = [...presets]
                                        newPresets[qIdx] = newVal
                                        setPresetsForItem(it.id, newPresets)
                                        setEditingButton(null)
                                        setEditingValue('')
                                      }
                                    }
                                    if (e.key === 'Escape') {
                                      e.preventDefault()
                                      setEditingButton(null)
                                      setEditingValue('')
                                    }
                                  }}
                                  className="w-10 h-7 px-1 rounded-lg bg-white text-blue-700 text-[11px] font-bold border border-blue-300 text-center focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newVal = Number(editingValue)
                                    if (!isNaN(newVal) && newVal > 0) {
                                      const newPresets = [...presets]
                                      newPresets[qIdx] = newVal
                                      setPresetsForItem(it.id, newPresets)
                                      setEditingButton(null)
                                      setEditingValue('')
                                    }
                                  }}
                                  className="w-6 h-7 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[9px] font-bold flex items-center justify-center transition"
                                  title="Save"
                                >
                                  ✓
                                </button>
                                {presets.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newPresets = presets.filter((_, i) => i !== qIdx)
                                      setPresetsForItem(it.id, newPresets)
                                      setEditingButton(null)
                                      setEditingValue('')
                                    }}
                                    className="w-5 h-7 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold flex items-center justify-center transition"
                                    title="Delete this button"
                                  >
                                    −
                                  </button>
                                )}
                              </div>
                            )
                          }

                          return (
                            <button
                              key={`btn-${qIdx}`}
                              type="button"
                              onClick={() => tap(it, q)}
                              onPointerDown={() => {
                                longPressTimeoutRef.current = setTimeout(() => {
                                  setEditingButton({ itemId: it.id, index: qIdx })
                                  setEditingValue(String(q))
                                  longPressTimeoutRef.current = null
                                }, 500)
                              }}
                              onPointerUp={() => {
                                if (longPressTimeoutRef.current) {
                                  clearTimeout(longPressTimeoutRef.current)
                                  longPressTimeoutRef.current = null
                                }
                              }}
                              onPointerLeave={() => {
                                if (longPressTimeoutRef.current) {
                                  clearTimeout(longPressTimeoutRef.current)
                                  longPressTimeoutRef.current = null
                                }
                              }}
                              disabled={pending}
                              title={`${q} unit${q > 1 ? 's' : ''} · ${money(total)}\n(long-press to edit)`}
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
                      {quickArrangeItemId === it.id && (
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Move "${it.name}" up?`)) {
                                moveBy(it.id, -1)
                                setQuickArrangeItemId(null)
                              }
                            }}
                            disabled={globalIdx === 0}
                            title="Move up"
                            className="shrink-0 w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Move "${it.name}" down?`)) {
                                moveBy(it.id, 1)
                                setQuickArrangeItemId(null)
                              }
                            }}
                            disabled={globalIdx === gridItems.length - 1}
                            title="Move down"
                            className="shrink-0 w-5 h-5 rounded bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-200 disabled:opacity-30"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Move "${it.name}" to top?`)) {
                                moveToTop(it.id)
                                setQuickArrangeItemId(null)
                              }
                            }}
                            disabled={globalIdx === 0}
                            title="Move to top"
                            className="shrink-0 px-1.5 h-5 rounded bg-blue-50 text-blue-700 text-[9px] font-bold flex items-center justify-center hover:bg-blue-100 disabled:opacity-30"
                          >
                            ⤒ Top
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickArrangeItemId(null)}
                            title="Close"
                            className="shrink-0 w-5 h-5 rounded bg-gray-200 text-gray-600 text-[10px] font-bold flex items-center justify-center hover:bg-gray-300"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
                  })
                })()}
              </div>
              {/* Pagination dots */}
              {gridItems.length > 0 && (
                <div className="flex items-center justify-center gap-2 py-3 border-b border-gray-200 bg-gray-50">
                  {(() => {
                    const totalPages = Math.ceil(gridItems.length / itemsPerPage)
                    return Array.from({ length: totalPages }).map((_, page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-2 h-2 rounded-full transition ${
                          page === currentPage ? 'bg-blue-600 w-6' : 'bg-gray-300 hover:bg-gray-400'
                        }`}
                        title={`Page ${page + 1}`}
                      />
                    ))
                  })()}
                </div>
              )}
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

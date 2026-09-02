'use client'
import React, { useState, useEffect, useMemo, memo, ReactNode } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { usePolling } from '@/lib/usePolling'
import { isOwnerLevel } from '@/lib/roles'
import HistoryPanel from './HistoryPanel'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
import { AnalyticsToggle } from './analyticsShared'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from './columnPrefs'
import { LossDialog, PairingDialog, type LossExtra, type LossPrompt, type PackRef, type PairingPrompt } from './CountDialogs'
import ItemDetailModal from './ItemDetailModal'
const CountsAnalyticsSection = dynamic(() => import('./CountsAnalyticsSection'), { ssr: false })

// Date and Item stay sticky/always-visible (first two columns), and the
// Edit/Delete actions column stays fixed at the end; these five are the
// only ones the picker can hide/reorder/rename.
type ColKey = 'group' | 'qty' | 'by' | 'src' | 'notes'
const COUNTS_COLUMNS: ColumnDef<ColKey>[] = [
  { key: 'group', label: 'GROUP' },
  { key: 'qty',   label: 'QTY' },
  { key: 'by',    label: 'BY' },
  { key: 'src',   label: 'SRC' },
  { key: 'notes', label: 'NOTES' },
]

// Default pixel widths for every column of the list table below, draggable
// via colPrefs.getWidth/resizeWidth -- keyed by the same names as ColKey
// plus the two fixed columns (date/item) and the trailing actions column,
// none of which are part of ColKey since they're never hidden/reordered.
const COUNTS_COL_DEFAULTS: Record<string, number> = {
  date: 78, item: 180, group: 96, qty: 64, by: 76, src: 64, notes: 160, actions: 92,
}

type Item = { id: number; item_name: string; cf_group: string | null; product_type?: string | null }

type CountRecord = {
  id: number
  item_id: number | null
  item_name: string
  count_date: string
  quantity_counted: string
  notes: string | null
  counted_by: string | null
  source: string | null
  cf_group: string | null
}

type DailyItem = {
  item_id: number; item_name: string; cf_group: string | null
  calculated_soh: number; last_count_date: string | null; days_overdue: number | null
}

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

function CountRow({ item, onSaved, onLoss, onPairing, onLog }: {
  item: DailyItem
  onSaved: (id: number) => void
  onLoss: (d: any, retry: (extra: LossExtra) => void) => void
  onPairing: (itemName: string, packs: PackRef[], retry: () => void) => void
  onLog?: (msg: string) => void
}) {
  const [customQty, setCustomQty] = useState('')
  const [saving, setSaving] = useState(false)
  const soh = Number(item.calculated_soh)

  async function submit(qty: number, lossExtra?: LossExtra) {
    const log = (msg: string) => { if (onLog) onLog(msg); console.log(msg) }
    log(`CountRow submit called, item: ${item.item_id}, qty: ${qty}`)
    setSaving(true)
    try {
      log(`Sending count to API: itemId=${item.item_id}, qty=${qty}`)
      const res = await fetch('/api/stock/count', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.item_id, qty, notes: '', ...(lossExtra ?? {}) }),
      })
      setSaving(false)
      log(`Count API response: status=${res.status}, ok=${res.ok}`)
      if (res.ok) {
        log(`✓ Count saved successfully`)
        onSaved(item.item_id);
        return
      }
      const d = await res.json().catch(() => null)
      log(`✗ Count API error: ${d?.error ?? 'unknown error'}`)
      if (res.status === 409 && d?.requires_pack_count) {
        onPairing(item.item_name, d.packs, () => submit(qty, lossExtra))
        return
      }
      if (res.status === 409 && d?.requires_loss_reason) {
        onLoss(d, extra => { submit(qty, extra) })
        return
      }
      alert(d?.error ?? 'Could not save count.')
    } catch (e) {
      setSaving(false)
      log(`✗ Count error: ${e instanceof Error ? e.message : String(e)}`)
      alert(`Error saving count: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const overdue = item.days_overdue
  const badgeClass = overdue === null || overdue === 0 ? 'bg-orange-100 text-orange-600'
    : overdue <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  const badgeLabel = overdue === null ? 'Never' : overdue === 0 ? 'Today' : `${overdue}d`

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-1.5 py-0.5 min-w-0">
        <p className="text-[10px] text-gray-900 font-semibold leading-tight truncate max-w-[110px]">{item.item_name}</p>
        {item.cf_group && <p className="text-[9px] text-gray-400 leading-tight truncate">{item.cf_group}</p>}
      </td>
      <td className="px-1 py-0.5 text-center text-[10px] font-bold text-gray-900 whitespace-nowrap">{soh}</td>
      <td className="px-1 py-0.5">
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>{badgeLabel}</span>
      </td>
      <td className="px-1 py-0.5">
        <div className="flex items-center gap-1">
          <button onClick={() => submit(soh)} disabled={saving}
            className="bg-green-700 hover:bg-green-600 disabled:opacity-40 text-white text-[9px] font-semibold rounded px-1.5 py-1 whitespace-nowrap transition">
            {saving ? '…' : `=${soh}`}
          </button>
          <input type="number" min="0" step="any" value={customQty} onChange={e => setCustomQty(e.target.value)}
            placeholder="qty" inputMode="decimal"
            className="w-11 bg-gray-100 border border-gray-200 rounded px-1 py-1 text-[10px] text-center outline-none focus:ring-1 focus:ring-blue-400" />
          <button onClick={() => { if (customQty !== '') submit(Number(customQty)) }}
            disabled={customQty === '' || saving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-[9px] font-semibold rounded px-1.5 py-1 transition">
            Save
          </button>
        </div>
      </td>
    </tr>
  )
}

// Ad-hoc count of ANY item, any time -- not just the ones due today. Same-day
// counts replace rather than duplicate (see /api/stock/count).
function ManualCountForm({ items, onSaved, onClose, onLoss, onPairing }: {
  items: Item[]
  onSaved: () => void
  onClose: () => void
  onLoss: (d: any, retry: (extra: LossExtra) => void) => void
  onPairing: (itemName: string, packs: PackRef[], retry: () => void) => void
}) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState<Item | null>(null)
  const [qty, setQty] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const matches = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return []
    return items
      // Services are not physical stock and can never be counted.
      .filter(i => i.product_type !== 'service' && !/^service/i.test(i.cf_group ?? '') && !/^service/i.test(i.item_name))
      .filter(i => i.item_name.toLowerCase().includes(t) || (i.cf_group ?? '').toLowerCase().includes(t))
      .slice(0, 25)
  }, [q, items])

  async function save(lossExtra?: LossExtra) {
    console.log('Save function called, sel:', sel, 'qty:', qty)
    if (!sel || qty === '') { console.log('Early return: sel or qty missing'); return }
    setSaving(true); setError('')
    try {
      console.log('Sending count to API:', { itemId: sel.id, qty: Number(qty) })
      const res = await fetch('/api/stock/count', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: sel.id, qty: Number(qty), notes: notes.trim() || 'Manual count', ...(lossExtra ?? {}) }),
      })
      setSaving(false)
      console.log('Count API response status:', res.status, 'ok:', res.ok)
      if (res.ok) {
        console.log('Count saved successfully')
        try {
          onSaved(); onClose()
        } catch (e) {
          console.error('Error after saving:', e)
          setError(`Error after saving: ${e instanceof Error ? e.message : String(e)}`)
        }
        return
      }
      const d = await res.json().catch(() => null)
      console.log('Count API error response:', d)
      if (res.status === 409 && d?.requires_pack_count) {
        onPairing(sel.item_name, d.packs, () => save(lossExtra))
        return
      }
      if (res.status === 409 && d?.requires_loss_reason) {
        onLoss(d, extra => { save(extra) })
        return
      }
      setError(d?.error ?? 'Could not save count.')
    } catch (e) {
      setSaving(false)
      console.error('Count save error:', e)
      setError(`Error saving count: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return (
    <div className="bg-blue-50 border-b border-blue-200 px-2 py-2 space-y-1.5 shrink-0">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-blue-700">Manual Count — any item, today&apos;s date</p>
        <button onClick={onClose} className="text-blue-300 hover:text-blue-500 font-bold leading-none">×</button>
      </div>
      {!sel ? (
        <>
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus
            placeholder="Search item to count…" className={inputCls} />
          {matches.length > 0 && (
            <div className="bg-white border border-gray-200 rounded max-h-40 overflow-y-auto divide-y divide-gray-100">
              {matches.map(i => (
                <button key={i.id} onClick={() => setSel(i)}
                  className="w-full text-left px-2 py-1.5 hover:bg-blue-50 transition">
                  <span className="text-[10px] font-semibold text-gray-900">{i.item_name}</span>
                  {i.cf_group && <span className="text-[9px] text-gray-400"> · {i.cf_group}</span>}
                </button>
              ))}
            </div>
          )}
          {q.trim() && matches.length === 0 && <p className="text-[9px] text-gray-400">No items match.</p>}
        </>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded px-2 py-1.5">
            <span className="text-[10px] font-semibold text-gray-900">{sel.item_name}</span>
            <button onClick={() => { setSel(null); setQty('') }} className="text-[9px] text-blue-600 font-semibold">change</button>
          </div>
          <div className="flex gap-1.5">
            <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)}
              placeholder="Qty counted" inputMode="decimal" autoFocus className={inputCls + ' w-24'} />
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional)" className={inputCls + ' flex-1'} />
            <button onClick={() => save()} disabled={qty === '' || saving}
              className="shrink-0 bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-white text-[10px] font-semibold rounded px-3 py-1 transition">
              {saving ? '…' : 'Save'}
            </button>
          </div>
          {error && <p className="text-[9px] text-red-500">{error}</p>}
        </div>
      )}
    </div>
  )
}

type Props = {
  items: Item[]
  groupFilter: string | null
  search: string
  violation: string | null
  onFixRecords?: (view: 'sales' | 'bills' | 'counts') => void
  // Jumps straight to a violation's own fix view (here: daily/7day/15day) --
  // same goToViolation used by Sales/Items' own flag buttons, passed down
  // since Counts isn't part of their shared green-bar toolbar (it carries
  // its own toolbar row instead, see the flag buttons below).
  onGoToViolation?: (key: string) => void
}

// Counts' 3 flag categories -- same treatment as Sales/Items' own flag
// buttons, just rendered in Counts' own toolbar instead of the shared bar.
const COUNTS_FLAG_TYPES: { key: 'daily' | '7day' | '15day'; letter: string; label: string }[] = [
  { key: 'daily', letter: 'D', label: 'Daily Counts' },
  { key: '7day', letter: '7', label: '7-Day Counts' },
  { key: '15day', letter: '15', label: '15-Day Counts' },
]

function CountsTab({ items, groupFilter, search, violation, onFixRecords, onGoToViolation }: Props) {
  const { data: session } = useSession()
  const canDelete = isOwnerLevel(session?.user as any)
  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [viewingItemId, setViewingItemId] = useState<number | null>(null)
  const lawsPanel = useLawsPanel('showCountsLaws')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [editQty, setEditQty] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [dailyItems, setDailyItems] = useState<DailyItem[]>([])
  const [gmcWeeklyItems, setGmcWeeklyItems] = useState<DailyItem[]>([])
  const [overdueItems, setOverdueItems] = useState<DailyItem[]>([])
  const [dailyLoading, setDailyLoading] = useState(true)
  const [showManual, setShowManual] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [lossPrompt, setLossPrompt] = useState<LossPrompt | null>(null)
  const promptLoss = (d: any, retry: (extra: LossExtra) => void) => setLossPrompt({ d, retry })
  const [pairingPrompt, setPairingPrompt] = useState<PairingPrompt | null>(null)
  const promptPairing = (itemName: string, packs: PackRef[], retry: () => void) => setPairingPrompt({ itemName, packs, retry })
    
  // Check if there are any items that can be counted (exclude services)
  const hasCountableItems = useMemo(() => {
    return items.some(i => i.product_type !== 'service' && !/^service/i.test(i.cf_group ?? '') && !/^service/i.test(i.item_name))
  }, [items])

  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const addLog = (msg: string) => {
    console.log(msg)
    setDebugLogs(prev => [...prev, msg])
    setTimeout(() => setDebugLogs(prev => prev.slice(1)), 5000)
  }
  const colPrefs = useColumnPrefs<ColKey>('countsTable', COUNTS_COLUMNS)

  function loadRecords() {
    fetch('/api/stock/counts').then(r => r.json()).then(d => { setRecords(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => { setRecords([]); setLoading(false) })
  }
  function loadDaily() {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/gmc-weekly').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, gmcWeekly, overdue]) => {
      setDailyItems(Array.isArray(daily) ? daily : []); setGmcWeeklyItems(Array.isArray(gmcWeekly) ? gmcWeekly : []); setOverdueItems(Array.isArray(overdue) ? overdue : []); setDailyLoading(false)
    }).catch(() => { setDailyItems([]); setGmcWeeklyItems([]); setOverdueItems([]); setDailyLoading(false) })
  }

  useEffect(() => { loadRecords() }, [])
  useEffect(() => { loadDaily() }, [])
  usePolling(loadRecords, 600000, editingId === null)
  usePolling(loadDaily, 600000, editingId === null)

  const groupItemNames = useMemo(() => {
    if (!groupFilter || groupFilter === 'All') return null
    return new Set(items.filter(i => (i.cf_group ?? 'Ungrouped') === groupFilter).map(i => i.item_name))
  }, [items, groupFilter])

  const filtered = useMemo(() => {
    let list = records
    if (groupItemNames) list = list.filter(r => groupItemNames.has(r.item_name))
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.item_name.toLowerCase().includes(q) ||
        (r.cf_group ?? '').toLowerCase().includes(q) ||
        (r.counted_by ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [records, groupItemNames, search])

  const filteredDaily = useMemo(() => {
    let list = dailyItems
    if (groupItemNames) list = list.filter(i => groupItemNames.has(i.item_name))
    if (search) list = list.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [dailyItems, groupItemNames, search])

  const filteredOverdue = useMemo(() => {
    let list = overdueItems
    if (groupItemNames) list = list.filter(i => groupItemNames.has(i.item_name))
    if (search) list = list.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [overdueItems, groupItemNames, search])

  const filteredGmcWeekly = useMemo(() => {
    let list = gmcWeeklyItems
    if (groupItemNames) list = list.filter(i => groupItemNames.has(i.item_name))
    if (search) list = list.filter(i => i.item_name.toLowerCase().includes(search.toLowerCase()))
    return list
  }, [gmcWeeklyItems, groupItemNames, search])

  function startEdit(r: CountRecord) {
    setEditQty(String(r.quantity_counted))
    setEditNotes(r.notes ?? '')
    setEditingId(r.id)
  }

  async function saveEdit(lossExtra?: { loss_reason: string; manager_response: string | null }) {
    if (editingId == null) return
    setSaving(true)
    const res = await fetch(`/api/stock/counts/${editingId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity_counted: Number(editQty), notes: editNotes, ...(lossExtra ?? {}) }),
    })
    setSaving(false)
    if (res.ok) {
      const updated: CountRecord = await res.json()
      setRecords(prev => prev.map(r => r.id === editingId ? { ...r, ...updated } : r))
      setEditingId(null)
    } else {
      const d = await res.json().catch(() => null)
      if (res.status === 409 && d?.requires_loss_reason) {
        promptLoss(d, extra => { saveEdit(extra) })
        return
      }
      alert(d?.error ?? 'Could not save count.')
    }
  }

  async function deleteCount(r: CountRecord) {
    if (!confirm(`Delete the count of ${Number(r.quantity_counted)} for "${r.item_name}" on ${fmtShort(r.count_date)}? This changes the loss/gain math from that day onward.`)) return
    const res = await fetch(`/api/stock/counts/${r.id}`, { method: 'DELETE' })
    if (res.ok) {
      setRecords(prev => prev.filter(x => x.id !== r.id))
      if (editingId === r.id) setEditingId(null)
    } else {
      alert((await res.json().catch(() => null))?.error ?? 'Could not delete count.')
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  // Daily/15-Day violation views
  if (violation === 'daily' || violation === '7day' || violation === '15day') {
    const countItems = violation === 'daily' ? filteredDaily : violation === '7day' ? filteredGmcWeekly : filteredOverdue
    const label = violation === 'daily' ? 'daily' : violation === '7day' ? '7-day GMC' : '15-day overdue'
    return (
      <div className="overflow-y-auto h-full py-2">
        {debugLogs.length > 0 && (
          <div className="fixed top-4 right-4 bg-black text-white text-[11px] rounded px-3 py-2 max-w-xs z-50 shadow-lg">
            {debugLogs.map((log, i) => <div key={i} className="whitespace-normal break-words">{log}</div>)}
          </div>
        )}
        {lossPrompt && <LossDialog prompt={lossPrompt} onClose={() => setLossPrompt(null)} onFixRecords={onFixRecords} />}
        {pairingPrompt && <PairingDialog prompt={pairingPrompt} onClose={() => setPairingPrompt(null)} />}
        <div className="flex justify-end px-2 pb-1">
          {hasCountableItems && (
            <button onClick={() => setShowManual(v => !v)}
              className="text-[9px] font-semibold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
              {showManual ? '× Close' : '+ Manual Count'}
            </button>
          )}
        </div>
        {showManual && (
          <ManualCountForm items={items} onClose={() => setShowManual(false)} onLoss={promptLoss} onPairing={promptPairing}
            onSaved={() => { loadRecords(); loadDaily() }} />
        )}
        {dailyLoading ? (
          <p className="py-10 text-center text-gray-400 text-[10px]">Loading…</p>
        ) : countItems.length === 0 ? (
          <p className="py-4 text-center text-gray-400 text-[10px]">
            {violation === 'daily' ? 'All daily items counted!'
              : violation === '7day' ? 'All GMC items counted within 7 days!'
              : 'All items up to date!'}
          </p>
        ) : (
          <table className="w-full border-collapse text-[10px]">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-1.5 py-0.5 font-semibold text-gray-500 border-b border-gray-200">Item</th>
                <th className="text-center px-1 py-0.5 font-semibold text-gray-500 border-b border-gray-200">SOH</th>
                <th className="px-1 py-0.5 font-semibold text-gray-500 border-b border-gray-200">Status</th>
                <th className="px-1 py-0.5 font-semibold text-gray-500 border-b border-gray-200">Count</th>
              </tr>
            </thead>
            <tbody>
              {countItems.map(item => (
                <CountRow key={item.item_id} item={item} onLoss={promptLoss} onPairing={promptPairing} onLog={addLog}
                  onSaved={id => {
                    if (violation === 'daily') setDailyItems(prev => prev.filter(i => i.item_id !== id))
                    else if (violation === '7day') setGmcWeeklyItems(prev => prev.filter(i => i.item_id !== id))
                    else setOverdueItems(prev => prev.filter(i => i.item_id !== id))
                  }} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    )
  }

  // List view
  if (showHistory) return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0">
        <button onClick={() => setShowHistory(false)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-600 text-white transition">
          ← Back
        </button>
        <span className="text-[9px] font-semibold text-purple-700">Counts History</span>
      </div>
      <HistoryPanel keywords={['stock', 'count']} onEntryClick={log => {
        // "counted stock": "ItemName · qty 5"
        // "edited stock count": "ItemName · qty 5 on 2024-01-15"
        const itemMatch = log.details?.match(/^(.+?) ·/)
        const dateMatch = log.details?.match(/on (\d{4}-\d{2}-\d{2})/)
        const itemName = itemMatch?.[1]
        const date = dateMatch?.[1]
        const target = records.find(r =>
          r.item_name === itemName && (date ? r.count_date.startsWith(date) : true)
        )
        setShowHistory(false)
        if (target) {
          setHighlightId(target.id)
          setTimeout(() => {
            document.getElementById(`count-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
        }
      }} />
    </div>
  )

  return (
    <div className="flex flex-col h-full min-h-0">
      {lossPrompt && <LossDialog prompt={lossPrompt} onClose={() => setLossPrompt(null)} onFixRecords={onFixRecords} />}
      {pairingPrompt && <PairingDialog prompt={pairingPrompt} onClose={() => setPairingPrompt(null)} />}
      {/* Law/Notes/Tasks + this page's own flag pills, together in one row,
          same treatment as Items/Sales/Bills -- pulled up out of the mixed
          view-controls row below (Manual Count/History/Columns/Analytics
          stay there, those are view controls, not flags). */}
      {!showAnalytics && (
        <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto px-2 pt-2">
          <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
        </div>
      )}
      {!showAnalytics && lawsPanel.show && (
        <div className="px-2">
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <PageLawsList
              scopeKey="Counts"
              isItemsLaws={true}
              onChange={lawsPanel.bumpRefresh}
              flags={COUNTS_FLAG_TYPES.map(({ key, label }) => ({
                key, label,
                count: key === 'daily' ? filteredDaily.length : key === '7day' ? filteredGmcWeekly.length : filteredOverdue.length,
                onViewClick: () => onGoToViolation?.(key),
              }))}
              openForm={lawsPanel.openForm}
              setOpenForm={lawsPanel.setOpenForm}
              hideZeroFlags={lawsPanel.hideZeroFlags}
              setHideZeroFlags={lawsPanel.setHideZeroFlags}
              activeFilters={lawsPanel.activeFilters}
            />
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-1.5 px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
        <AnalyticsToggle showing={showAnalytics} onToggle={() => setShowAnalytics(a => !a)} />
        {!showAnalytics && <>
        <button onClick={() => setShowManual(v => !v)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
          {showManual ? '× Close' : '+ Manual Count'}
        </button>
        <button onClick={() => setShowHistory(true)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition">
          History
        </button>
        <ColumnsPickerButton prefs={colPrefs} />
        </>}
      </div>
      {showAnalytics && (
        <div className="flex-1 overflow-y-auto min-h-0 p-2">
          <CountsAnalyticsSection />
        </div>
      )}
      {!showAnalytics && showManual && (
        <ManualCountForm items={items} onClose={() => setShowManual(false)} onLoss={promptLoss} onPairing={promptPairing}
          onSaved={() => { loadRecords(); loadDaily() }} />
      )}
      {!showAnalytics && <div className="flex-1 overflow-y-auto min-h-0 px-2 pb-2">
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
        <table className="border-collapse text-[10px]" style={{
          tableLayout: 'fixed',
          width: colPrefs.getWidth('date', COUNTS_COL_DEFAULTS.date) + colPrefs.getWidth('item', COUNTS_COL_DEFAULTS.item)
            + colPrefs.shownColumns.reduce((s, c) => s + colPrefs.getWidth(c.key, COUNTS_COL_DEFAULTS[c.key] ?? 80), 0)
            + colPrefs.getWidth('actions', COUNTS_COL_DEFAULTS.actions),
        }}>
          <colgroup>
            <col style={{ width: colPrefs.getWidth('date', COUNTS_COL_DEFAULTS.date) }} />
            <col style={{ width: colPrefs.getWidth('item', COUNTS_COL_DEFAULTS.item) }} />
            {colPrefs.shownColumns.map(c => <col key={c.key} style={{ width: colPrefs.getWidth(c.key, COUNTS_COL_DEFAULTS[c.key] ?? 80) }} />)}
            <col style={{ width: colPrefs.getWidth('actions', COUNTS_COL_DEFAULTS.actions) }} />
          </colgroup>
          <thead className="sticky top-0 bg-gray-50 z-10">
            <tr>
              <ResizableTh onResize={d => colPrefs.resizeWidth('date', d, COUNTS_COL_DEFAULTS.date)} onReset={() => colPrefs.resetWidth('date')}>Date</ResizableTh>
              <ResizableTh onResize={d => colPrefs.resizeWidth('item', d, COUNTS_COL_DEFAULTS.item)} onReset={() => colPrefs.resetWidth('item')}>Item</ResizableTh>
              {colPrefs.shownColumns.map(c => (
                <ResizableTh key={c.key} align={c.key === 'qty' ? 'center' : 'left'}
                  onResize={d => colPrefs.resizeWidth(c.key, d, COUNTS_COL_DEFAULTS[c.key] ?? 80)} onReset={() => colPrefs.resetWidth(c.key)}>
                  {c.label}
                </ResizableTh>
              ))}
              <ResizableTh noDivider onResize={d => colPrefs.resizeWidth('actions', d, COUNTS_COL_DEFAULTS.actions)} onReset={() => colPrefs.resetWidth('actions')} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <>
                <tr key={r.id} id={`count-${r.id}`}
                  className={`transition-colors ${highlightId === r.id ? 'bg-yellow-50' : i % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'} hover:bg-blue-50/40`}>
                  <td className="px-2.5 py-0 text-gray-500 truncate border-b border-gray-100">{fmtShort(r.count_date)}</td>
                  <td className="px-2.5 py-0 text-gray-900 font-semibold border-b border-gray-100 overflow-hidden">
                    {r.item_id ? (
                      <button type="button" onClick={() => setViewingItemId(r.item_id!)} className="block truncate text-blue-600 hover:underline text-left">{r.item_name}</button>
                    ) : <span className="block truncate">{r.item_name}</span>}
                  </td>
                  {colPrefs.shownColumns.map(c => {
                    if (c.key === 'group') return <td key={c.key} className="px-2.5 py-0 text-gray-500 truncate border-b border-gray-100">{r.cf_group ?? '—'}</td>
                    if (c.key === 'qty') return <td key={c.key} className="px-2.5 py-0 text-center font-bold text-gray-900 truncate border-b border-gray-100">{Number(r.quantity_counted)}</td>
                    if (c.key === 'by') return <td key={c.key} className="px-2.5 py-0 text-blue-600 font-medium truncate border-b border-gray-100">{r.counted_by ?? '—'}</td>
                    if (c.key === 'src') return <td key={c.key} className="px-2.5 py-0 text-gray-500 truncate border-b border-gray-100">{r.source ?? '—'}</td>
                    return <td key={c.key} className="px-2.5 py-0 text-gray-500 italic truncate border-b border-gray-100">{r.notes ?? '—'}</td>
                  })}
                  <td className="px-2.5 py-0 border-b border-gray-100 overflow-hidden">
                    <div className="flex gap-1 justify-end whitespace-nowrap">
                      <button onClick={() => editingId === r.id ? setEditingId(null) : startEdit(r)}
                        className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-2 py-0.5 rounded-full hover:bg-blue-100 transition">
                        {editingId === r.id ? 'Close' : 'Edit'}
                      </button>
                      {canDelete && (
                        <button onClick={() => deleteCount(r)}
                          className="text-[9px] text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full hover:bg-red-100 transition">
                          Del
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === r.id && (
                  <tr key={`edit-${r.id}`} className="bg-blue-50/50">
                    <td colSpan={3 + colPrefs.shownColumns.length} className="px-3 py-2.5 border-b border-gray-100">
                      <div className="flex items-end gap-2 flex-wrap">
                        <div>
                          <p className="text-[9px] text-gray-400 mb-0.5">Qty Counted</p>
                          <input type="number" min="0" step="any" value={editQty}
                            onChange={e => setEditQty(e.target.value)} className={inputCls + ' w-24'} />
                        </div>
                        <div>
                          <p className="text-[9px] text-gray-400 mb-0.5">Notes</p>
                          <input value={editNotes} onChange={e => setEditNotes(e.target.value)}
                            placeholder="Optional" className={inputCls + ' w-40'} />
                        </div>
                        <div className="flex gap-1.5">
                          <button onClick={() => saveEdit()} disabled={saving}
                            className="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold rounded-lg px-3 py-1.5 disabled:opacity-40 transition">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-semibold rounded-lg transition">Cancel</button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-[10px] text-gray-400 text-center py-10">No records</p>}
        </div>
        </div>
      </div>}
      {viewingItemId != null && (
        <ItemDetailModal itemId={viewingItemId} onClose={() => setViewingItemId(null)} />
      )}
    </div>
  )
}

class CountsTabErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('CountsTab error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-50 border border-red-200 rounded p-4 m-4">
          <p className="text-sm font-semibold text-red-700">Error in Counts</p>
          <p className="text-xs text-red-600 mt-2">{this.state.error?.message || 'An unexpected error occurred'}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-3 px-3 py-1 bg-red-600 text-white text-xs font-semibold rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const CountsTabWithErrorBoundary = (props: Props) => (
  <CountsTabErrorBoundary>
    <CountsTab {...props} />
  </CountsTabErrorBoundary>
)

export default memo(CountsTabWithErrorBoundary)

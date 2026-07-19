'use client'
import { useState, useEffect, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { usePolling } from '@/lib/usePolling'
import { isOwnerLevel } from '@/lib/roles'
import HistoryPanel from './HistoryPanel'

type Item = { id: number; item_name: string; cf_group: string | null; product_type?: string | null }

type CountRecord = {
  id: number
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

type LossExtra = { loss_reason: string; manager_response: string | null }
type LossPrompt = { d: any; retry: (extra: LossExtra) => void }

// A count that reveals a loss is not saved silently. This dialog first offers
// the tools that usually explain a "loss" -- a mistyped sale, a missing bill,
// an earlier miscount -- so records can be fixed and the item recounted.
// Only if it's a real loss does the counter give a reason and (unless they
// are the manager) enter what the manager said.
function LossDialog({ prompt: lp, onClose, onFixRecords }: {
  prompt: LossPrompt
  onClose: () => void
  onFixRecords?: (view: 'sales' | 'bills' | 'counts') => void
}) {
  const [reason, setReason] = useState('')
  const [mgr, setMgr] = useState('')
  const [err, setErr] = useState('')
  const d = lp.d

  function confirmLoss() {
    if (!reason.trim()) { setErr('A reason for the loss is required.'); return }
    if (!d.is_manager && !mgr.trim()) { setErr("Inform the manager and enter what the manager said."); return }
    lp.retry({ loss_reason: reason.trim(), manager_response: d.is_manager ? null : mgr.trim() })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-3">
        <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <p className="text-sm font-bold text-red-700">⚠ Loss detected — count not saved yet</p>
          <p className="text-xs text-red-800 mt-0.5">
            Expected <b>{d.expected}</b>, counted <b>{d.counted}</b> → loss of <b>-{d.loss}</b>.
          </p>
        </div>

        {onFixRecords && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-gray-700">
              First check whether a record mistake caused this — fix it, then count again:
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={() => { onClose(); onFixRecords('sales') }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg py-2 transition">
                📄 Sales
              </button>
              <button onClick={() => { onClose(); onFixRecords('bills') }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg py-2 transition">
                🧾 Bills
              </button>
              <button onClick={() => { onClose(); onFixRecords('counts') }}
                className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg py-2 transition">
                🔢 Counts
              </button>
            </div>
            <p className="text-[10px] text-gray-400">
              A sale entered with the wrong quantity, a bill never recorded, or an earlier miscount all show up as a "loss".
            </p>
          </div>
        )}

        <div className="border-t border-gray-100 pt-2 space-y-1.5">
          <p className="text-xs font-semibold text-gray-700">Or confirm it is a real loss:</p>
          <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
            placeholder="Why did this loss happen? (required)"
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300" />
          {!d.is_manager && (
            <textarea value={mgr} onChange={e => setMgr(e.target.value)} rows={2}
              placeholder="Inform the manager now — what did the manager say? (required)"
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-red-300" />
          )}
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={confirmLoss}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-xl py-2.5 transition">
              Save as Loss
            </button>
            <button onClick={onClose}
              className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

type PackRef = { id: number; name: string }
type PairingPrompt = { itemName: string; packs: PackRef[]; retry: () => void }

// A blocking pack-chain (A4 Brown Envelope, A4 Lamination, 4x6): the singles
// count can't be saved until one of its packs is also counted today -- a
// pack can otherwise sit open through an entire USED/PACK overrun with
// nobody noticing. Lets the counter enter the pack's qty right here instead
// of navigating away and coming back.
function PairingDialog({ prompt: pp, onClose }: { prompt: PairingPrompt; onClose: () => void }) {
  const [packId, setPackId] = useState<number>(pp.packs[0].id)
  const [qty, setQty] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  async function saveBoth() {
    if (qty === '') { setErr('Enter the pack count.'); return }
    setSaving(true); setErr('')
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: packId, qty: Number(qty), notes: '' }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => null)
      setErr(d?.error ?? 'Could not save the pack count.')
      return
    }
    onClose()
    pp.retry()
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          <p className="text-sm font-bold text-amber-800">Count the pack too</p>
          <p className="text-xs text-amber-900 mt-0.5">
            &quot;{pp.itemName}&quot; is paired with {pp.packs.map(p => p.name).join(' / ')} — count it too before this can be saved.
          </p>
        </div>
        {pp.packs.length > 1 && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Which pack?</p>
            <select value={packId} onChange={e => setPackId(Number(e.target.value))}
              className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none">
              {pp.packs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-1">Pack qty counted</p>
          <input type="number" min="0" step="any" value={qty} onChange={e => setQty(e.target.value)}
            inputMode="decimal" autoFocus
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        {err && <p className="text-xs text-red-600">{err}</p>}
        <div className="flex gap-2">
          <button onClick={saveBoth} disabled={saving}
            className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? 'Saving…' : 'Save Both'}
          </button>
          <button onClick={onClose}
            className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

function CountRow({ item, onSaved, onLoss, onPairing }: {
  item: DailyItem
  onSaved: (id: number) => void
  onLoss: (d: any, retry: (extra: LossExtra) => void) => void
  onPairing: (itemName: string, packs: PackRef[], retry: () => void) => void
}) {
  const [customQty, setCustomQty] = useState('')
  const [saving, setSaving] = useState(false)
  const soh = Number(item.calculated_soh)

  async function submit(qty: number, lossExtra?: LossExtra) {
    setSaving(true)
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: item.item_id, qty, notes: '', ...(lossExtra ?? {}) }),
    })
    setSaving(false)
    if (res.ok) { onSaved(item.item_id); return }
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.requires_pack_count) {
      onPairing(item.item_name, d.packs, () => submit(qty, lossExtra))
      return
    }
    if (res.status === 409 && d?.requires_loss_reason) {
      onLoss(d, extra => { submit(qty, extra) })
      return
    }
    alert(d?.error ?? 'Could not save count.')
  }

  const overdue = item.days_overdue
  const badgeClass = overdue === null || overdue === 0 ? 'bg-orange-100 text-orange-600'
    : overdue <= 2 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  const badgeLabel = overdue === null ? 'Never' : overdue === 0 ? 'Today' : `${overdue}d`

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-1.5 py-1 min-w-0">
        <p className="text-[10px] text-gray-900 font-semibold leading-tight truncate max-w-[110px]">{item.item_name}</p>
        {item.cf_group && <p className="text-[9px] text-gray-400 leading-tight truncate">{item.cf_group}</p>}
      </td>
      <td className="px-1 py-1 text-center text-[10px] font-bold text-gray-900 whitespace-nowrap">{soh}</td>
      <td className="px-1 py-1">
        <span className={`text-[9px] font-semibold px-1 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>{badgeLabel}</span>
      </td>
      <td className="px-1 py-1">
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
    if (!sel || qty === '') return
    setSaving(true); setError('')
    const res = await fetch('/api/stock/count', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: sel.id, qty: Number(qty), notes: notes.trim() || 'Manual count', ...(lossExtra ?? {}) }),
    })
    setSaving(false)
    if (res.ok) { onSaved(); onClose(); return }
    const d = await res.json().catch(() => null)
    if (res.status === 409 && d?.requires_pack_count) {
      onPairing(sel.item_name, d.packs, () => save(lossExtra))
      return
    }
    if (res.status === 409 && d?.requires_loss_reason) {
      onLoss(d, extra => { save(extra) })
      return
    }
    setError(d?.error ?? 'Could not save count.')
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
}

export default function CountsTab({ items, groupFilter, search, violation, onFixRecords }: Props) {
  const { data: session } = useSession()
  const canDelete = isOwnerLevel(session?.user as any)
  const [records, setRecords] = useState<CountRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
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
  const [lossPrompt, setLossPrompt] = useState<LossPrompt | null>(null)
  const promptLoss = (d: any, retry: (extra: LossExtra) => void) => setLossPrompt({ d, retry })
  const [pairingPrompt, setPairingPrompt] = useState<PairingPrompt | null>(null)
  const promptPairing = (itemName: string, packs: PackRef[], retry: () => void) => setPairingPrompt({ itemName, packs, retry })

  function loadRecords() {
    fetch('/api/stock/counts').then(r => r.json()).then(d => { setRecords(d); setLoading(false) })
  }
  function loadDaily() {
    Promise.all([
      fetch('/api/stock/daily').then(r => r.json()),
      fetch('/api/stock/gmc-weekly').then(r => r.json()),
      fetch('/api/stock/overdue').then(r => r.json()),
    ]).then(([daily, gmcWeekly, overdue]) => {
      setDailyItems(daily); setGmcWeeklyItems(gmcWeekly); setOverdueItems(overdue); setDailyLoading(false)
    })
  }

  useEffect(() => { loadRecords() }, [])
  useEffect(() => { loadDaily() }, [])
  usePolling(loadRecords, 5000, editingId === null)
  usePolling(loadDaily, 5000, editingId === null)

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
        {lossPrompt && <LossDialog prompt={lossPrompt} onClose={() => setLossPrompt(null)} onFixRecords={onFixRecords} />}
        {pairingPrompt && <PairingDialog prompt={pairingPrompt} onClose={() => setPairingPrompt(null)} />}
        <div className="flex justify-end px-2 pb-1">
          <button onClick={() => setShowManual(v => !v)}
            className="text-[9px] font-semibold px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
            {showManual ? '× Close' : '+ Manual Count'}
          </button>
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
                <th className="text-left px-1.5 py-1 font-semibold text-gray-500 border-b border-gray-200">Item</th>
                <th className="text-center px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">SOH</th>
                <th className="px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">Status</th>
                <th className="px-1 py-1 font-semibold text-gray-500 border-b border-gray-200">Count</th>
              </tr>
            </thead>
            <tbody>
              {countItems.map(item => (
                <CountRow key={item.item_id} item={item} onLoss={promptLoss} onPairing={promptPairing}
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
      <div className="flex items-center justify-end gap-1.5 px-2 py-1 border-b border-gray-100 bg-gray-50 shrink-0">
        <button onClick={() => setShowManual(v => !v)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-500 transition">
          {showManual ? '× Close' : '+ Manual Count'}
        </button>
        <button onClick={() => setShowHistory(true)}
          className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-purple-100 hover:text-purple-700 transition">
          History
        </button>
      </div>
      {showManual && (
        <ManualCountForm items={items} onClose={() => setShowManual(false)} onLoss={promptLoss} onPairing={promptPairing}
          onSaved={() => { loadRecords(); loadDaily() }} />
      )}
      <div className="flex-1 overflow-y-auto min-h-0">
        <table className="w-full border-collapse text-[10px] border border-black">
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black whitespace-nowrap">DATE</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">ITEM</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">GROUP</th>
              <th className="text-center px-1 py-1 font-semibold text-gray-700 border border-black">QTY</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">BY</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">SRC</th>
              <th className="text-left px-1 py-1 font-semibold text-gray-700 border border-black">NOTES</th>
              <th className="px-1 py-1 border border-black" />
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <>
                <tr key={r.id} id={`count-${r.id}`}
                  className={`hover:bg-gray-50 transition-colors ${highlightId === r.id ? 'bg-yellow-100' : ''}`}>
                  <td className="px-1 py-1 text-gray-600 whitespace-nowrap border border-black">{fmtShort(r.count_date)}</td>
                  <td className="px-1 py-1 text-gray-900 font-semibold border border-black">{r.item_name}</td>
                  <td className="px-1 py-1 text-gray-500 border border-black">{r.cf_group ?? '—'}</td>
                  <td className="px-1 py-1 text-center font-bold text-gray-900 border border-black">{Number(r.quantity_counted)}</td>
                  <td className="px-1 py-1 text-blue-500 border border-black">{r.counted_by ?? '—'}</td>
                  <td className="px-1 py-1 text-gray-500 border border-black">{r.source ?? '—'}</td>
                  <td className="px-1 py-1 text-gray-500 italic border border-black">{r.notes ?? '—'}</td>
                  <td className="px-1 py-1 border border-black">
                    <div className="flex gap-0.5 justify-end whitespace-nowrap">
                      <button onClick={() => editingId === r.id ? setEditingId(null) : startEdit(r)}
                        className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100">
                        {editingId === r.id ? 'Close' : 'Edit'}
                      </button>
                      {canDelete && (
                        <button onClick={() => deleteCount(r)}
                          className="text-[9px] text-red-500 font-semibold bg-red-50 px-1.5 py-0.5 rounded hover:bg-red-100">
                          Del
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {editingId === r.id && (
                  <tr key={`edit-${r.id}`} className="bg-blue-50/40 border-b border-blue-200">
                    <td colSpan={8} className="px-2 py-2">
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
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit()} disabled={saving}
                            className="bg-green-600 text-white text-[10px] font-bold rounded px-3 py-1 disabled:opacity-40">
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button onClick={() => setEditingId(null)}
                            className="px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">Cancel</button>
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
  )
}

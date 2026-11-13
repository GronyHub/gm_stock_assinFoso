'use client'
import { useCallback, useEffect, useState } from 'react'
import GroupForm from '@/components/GroupForm'

type Lock = { locked: boolean; day: string | null; cash: { receiptId: number; salesTotal: number; counted: number | null } | null; shortage: { receiptId: number; salesTotal: number; counted: number; short: number } | null; questions: { tileId: number } | null; approvals?: number; owner?: boolean; joe?: Lock }
const money = (v: number) => v.toLocaleString('en-GH', { maximumFractionDigits: 2 })

// "Before you continue": the manager closes the previous working day here (Cash Counted, then the manager's closing questions). Nothing else in the app opens until both are done.
export default function StartOfDayClient() {
  const [lock, setLock] = useState<Lock | null>(null)
  const [val, setVal] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  // Clock times from earlier days waiting for this person's decision (the same list as the approval box).
  type Pend = { id: number; staff: string; work_date: string; field?: string; proposed_out: string; actual_in: string | null; requested_at: string }
  const [pend, setPend] = useState<Pend[]>([])
  const [pick, setPick] = useState<Record<number, string>>({})
  const loadPend = useCallback(() => fetch('/api/clock/corrections', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setPend(Array.isArray(d?.pending) ? d.pending : [])).catch(() => {}), [])
  async function decideTime(id: number, action: 'approve' | 'reject') {
    const r = await fetch('/api/clock/corrections', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, action, time: action === 'approve' ? pick[id] : undefined }) })
    if (!r.ok) { const d = await r.json().catch(() => ({})); setMsg(d.error ?? 'Could not save.'); return }
    void loadPend(); void load()
  }
  const load = useCallback(() => fetch('/api/manager-lock?fresh=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => d && setLock(d)).catch(() => {}), [])
  useEffect(() => { void load(); void loadPend() }, [load, loadPend])
  if (!lock) return <p className="p-4 text-sm text-gray-500">Loading…</p>

  async function saveCash(l: Lock) {
    const v = parseFloat(val)
    const rid = l.cash?.receiptId ?? l.shortage?.receiptId
    if (!rid || isNaN(v) || v < 0) { setMsg('Enter the cash you counted.'); return }
    setBusy(true); setMsg('')
    const r = await fetch(`/api/sales/${rid}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cash_counted: v }) })
    setBusy(false)
    if (!r.ok) { setMsg('Could not save. Try again.'); return }
    setVal(''); void load()
  }
  async function excuse(day: string) {
    if (!confirm(`Excuse Joe for ${day}? He will not be asked for it.`)) return
    await fetch('/api/manager-lock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ excuse: day }) }); void load()
  }

  const l = lock.owner && lock.joe ? lock.joe : lock
  return (
    <div className="mx-auto max-w-xl space-y-3 p-3">
      <h1 className="text-base font-extrabold text-gray-900">Before you continue</h1>
      {lock.owner && <p className="rounded-lg bg-blue-50 p-2 text-xs font-semibold text-blue-800">Owner view of Joe&apos;s block. {l.locked ? `Joe is blocked${l.day ? ` for ${l.day}` : ''}${(l.approvals ?? 0) > 0 ? `; ${l.approvals} clock time${l.approvals === 1 ? '' : 's'} waiting for him` : ''}.` : 'Joe is not blocked.'}{l.locked && l.day && <button type="button" onClick={() => void excuse(l.day!)} className="ml-2 rounded bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">Excuse this day</button>}</p>}
      {!l.locked && !lock.owner && (
        <div className="space-y-2 rounded-xl border border-green-300 bg-green-50 p-3">
          <p className="text-sm font-bold text-green-800">All done. The previous day is closed.</p>
          <a href="/item" className="block rounded-xl bg-green-600 py-2.5 text-center text-sm font-bold text-white">Go to the app</a>
        </div>)}
      {l.locked && !lock.owner && <p className="text-xs text-gray-600">The app opens once {(l.approvals ?? 0) > 0 ? 'you have decided the clock times below' : ''}{(l.approvals ?? 0) > 0 && l.day ? ' and ' : ''}{l.day ? `${l.day} is closed (its Cash Counted entered and your closing questions answered)` : ''}. Until then you can only do this.</p>}

      {(l.approvals ?? 0) > 0 && !lock.owner && (
        <div className="space-y-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-sm font-extrabold text-gray-900">Clock times to decide ({l.approvals})</p>
          <p className="text-[12px] text-gray-700">These were sent on an earlier day. Approve or reject each one before you carry on.</p>
          {pend.filter(p => p.requested_at < new Date().toISOString().slice(0, 10)).map(p => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white p-2 text-sm text-gray-900">
              <span className="min-w-0 flex-1"><b>{p.staff.charAt(0).toUpperCase() + p.staff.slice(1)}</b> · {p.work_date} · in {p.actual_in ?? '?'} · says {p.field === 'in' ? 'in' : 'out'} <b>{p.proposed_out}</b></span>
              <input type="time" value={pick[p.id] ?? ''} onChange={e => setPick(x => ({ ...x, [p.id]: e.target.value }))} title="Optional: approve an earlier time instead" className="w-24 rounded-lg border p-1 text-xs" />
              <button type="button" onClick={() => void decideTime(p.id, 'approve')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Approve</button>
              <button type="button" onClick={() => void decideTime(p.id, 'reject')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">Reject</button>
            </div>))}
          {msg && <p className="text-xs font-semibold text-red-700">{msg}</p>}
        </div>)}

      {l.cash && (
        <div className="space-y-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-sm font-extrabold text-gray-900">1. Cash Counted for {l.day}</p>
          <p className="text-[12px] text-gray-700">Sales written down for the day: <b>{money(l.cash.salesTotal)}</b>. Count the cash, then enter it. Cash Counted includes all cash received for the day, whether from MoMo, debtors, part payments or other sources.</p>
          {!lock.owner && <div className="flex gap-2">
            <input type="number" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} placeholder="Cash counted" className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm" />
            <button type="button" disabled={busy} onClick={() => void saveCash(l)} className="rounded-xl bg-green-600 px-4 text-sm font-bold text-white disabled:opacity-40">Save</button>
          </div>}
          {msg && <p className="text-xs font-semibold text-red-700">{msg}</p>}
        </div>)}

      {l.shortage && (
        <div className="space-y-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-sm font-extrabold text-gray-900">{l.cash ? '2' : '1'}. Cash is short for {l.day}</p>
          <p className="text-[12px] text-gray-700">Cash counted <b>{money(l.shortage.counted)}</b> is <b>{money(l.shortage.short)}</b> less than the sales written down (<b>{money(l.shortage.salesTotal)}</b>): negative work not written. Open the Sales Log and put the day right (a wrong or doubled sale, a missing customer), or recount the cash. The app unlocks once the cash counted is not less than the sales.</p>
          {!lock.owner && <>
            <a href="/item?view=sales" className="block rounded-xl bg-blue-600 py-2.5 text-center text-sm font-bold text-white">Open the Sales Log</a>
            <div className="flex gap-2">
              <input type="number" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} placeholder="Recount: cash counted" className="min-w-0 flex-1 rounded-lg border border-gray-300 p-2 text-sm" />
              <button type="button" disabled={busy} onClick={() => void saveCash(l)} className="rounded-xl bg-gray-700 px-4 text-sm font-bold text-white disabled:opacity-40">Save</button>
            </div>
            {msg && <p className="text-xs font-semibold text-red-700">{msg}</p>}
          </>}
        </div>)}

      {l.questions && l.day && !lock.owner && (
        <div className="space-y-2 rounded-xl border-2 border-red-300 bg-red-50 p-3">
          <p className="text-sm font-extrabold text-gray-900">{(l.cash ? 1 : 0) + (l.shortage ? 1 : 0) + ((l.approvals ?? 0) > 0 ? 1 : 0) + 1}. Closing questions for {l.day}</p>
          <GroupForm tileId={l.questions.tileId} day={l.day} editable canEdit={false} onSaved={() => void load()} onClose={() => void load()} />
        </div>)}
    </div>
  )
}

'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PendingJob, JobLine } from '@/lib/pendingJobs'
import { pendingJobWhatsAppUrl } from '@/lib/customerProfile'

const today = () => new Date().toISOString().slice(0, 10)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const money = (n: number) => `₵${n.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const jobNo = (id: number) => `PJ-${String(id).padStart(4, '0')}`
const TABS = [['open', 'Open'], ['ready', 'Ready to collect'], ['done', 'Collected'], ['debt', 'Debtors'], ['all', 'All']] as const
type Cust = { id: number; customer_id_code: string | null; display_name: string | null; company_name: string | null; phone: string | null }
type Item = { id: number; name: string; selling_price: number | string; soh: number | string }
const blankForm = { customer: '', customer_id: '', phone: '', due_on: '', note: '', deposit: '', method: 'cash', receipt_id: 0, prepaid: false }
const openWa = (url: string) => { window.open(url, '_blank') }
const waOf = (j: PendingJob, kind: 'received' | 'ready' | 'reminder') => pendingJobWhatsAppUrl(kind, { jobNo: jobNo(j.id), customer: j.customer, customerId: j.customer_id, phone: j.phone ?? '', lines: j.lines, total: j.total, paid: j.paid, due_on: j.due_on, prepaid: j.prepaid, job: j.job })

// Pending jobs: the jobs customers leave behind. The full amount is recorded on the job; only the money actually taken (the deposit, later payments) counts in the
// Sales Log total; what is left is the customer's balance, on the Debtors list. A sale already paid in full in the Sales Log can also be made a pending job.
export default function PendingJobsClient({ canDelete }: { canDelete: boolean }) {
  const [jobs, setJobs] = useState<PendingJob[] | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('open')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState(blankForm)
  const [lines, setLines] = useState<JobLine[]>([])
  const [itemQ, setItemQ] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [custQ, setCustQ] = useState('')
  const [custs, setCusts] = useState<Cust[]>([])
  const [edit, setEdit] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [pay, setPay] = useState<{ id: number; amount: string; method: string; refund: boolean } | null>(null)
  const [made, setMade] = useState<PendingJob | null>(null)
  const [msg, setMsg] = useState('')
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500) }
  const load = useCallback(() => fetch('/api/pending-jobs?status=all', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setJobs(d?.jobs ?? [])).catch(() => setJobs([])), [])
  useEffect(() => { void load() }, [load])
  // opened from Live Sale (?new=1) or from a Sales Log row (?fromTap=ID: that sale, paid in full, becomes a pending job)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const tap = Number(p.get('fromTap'))
    if (tap) fetch(`/api/pending-jobs/from-sale?tapId=${tap}`).then(r => r.ok ? r.json() : null).then(d => { if (!d) return; setAdding(true); setLines(d.lines ?? []); setCustQ(d.customer ?? ''); setForm(f => ({ ...f, customer: d.customer ?? '', customer_id: d.customer_id ?? '', phone: d.phone ?? '', receipt_id: d.receipt_id ?? 0, prepaid: true })) }).catch(() => {})
    else if (p.get('new')) setAdding(true)
  }, [])
  useEffect(() => { const t = setTimeout(() => { if (itemQ.trim().length >= 2) fetch(`/api/items/search?q=${encodeURIComponent(itemQ.trim())}`).then(r => r.ok ? r.json() : []).then(d => setItems(Array.isArray(d) ? d.slice(0, 8) : [])).catch(() => {}); else setItems([]) }, 250); return () => clearTimeout(t) }, [itemQ])
  useEffect(() => { const t = setTimeout(() => { if (custQ.trim().length >= 2 && !form.customer_id) fetch(`/api/customers/search?q=${encodeURIComponent(custQ.trim())}`).then(r => r.ok ? r.json() : []).then(d => setCusts(Array.isArray(d) ? d.slice(0, 6) : [])).catch(() => {}); else setCusts([]) }, 250); return () => clearTimeout(t) }, [custQ, form.customer_id])
  async function send(method: string, path: string, body: object, ok: string) {
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { flash(j.error ?? 'Failed'); return null }
    flash(ok); void load(); return j
  }
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const dep = form.prepaid ? 0 : Math.max(0, Number(form.deposit) || 0)
  const left = Math.max(0, total - dep)
  async function add() {
    const j = await send('POST', '/api/pending-jobs', { ...form, lines, deposit: { amount: dep, method: form.method } }, form.prepaid ? 'Pending job made from the sale.' : 'Job written down.')
    if (j?.job) { setMade(j.job); setForm(blankForm); setLines([]); setCustQ(''); setAdding(false) }
  }
  const t = today()
  const open = (jobs ?? []).filter(j => j.status !== 'done')
  const overdue = open.filter(j => j.due_on && j.due_on < t).length
  const owing = (jobs ?? []).filter(j => j.balance > 0.005)
  const owed = owing.reduce((s, j) => s + j.balance, 0)
  const shown = useMemo(() => (jobs ?? []).filter(j => (tab === 'all' || (tab === 'open' ? j.status !== 'done' : tab === 'debt' ? j.balance > 0.005 : j.status === tab)) && (!q.trim() || `${j.customer} ${j.customer_id ?? ''} ${j.phone ?? ''} ${j.job} ${j.note ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [jobs, tab, q])
  const byCustomer = useMemo(() => { const m = new Map<string, PendingJob[]>(); for (const j of shown) { const k = (j.phone || j.customer).toLowerCase(); if (!m.has(k)) m.set(k, []); m.get(k)!.push(j) } return Array.from(m.values()) }, [shown])

  const card = (j: PendingJob) => {
    const late = j.status !== 'done' && j.due_on && j.due_on < t
    const dueTxt = j.due_on ? (j.due_on === t ? 'Due today' : late ? `Overdue ${days(j.due_on, t)} day${days(j.due_on, t) === 1 ? '' : 's'}` : `Due ${dlabel(j.due_on)}`) : 'No date promised'
    return (
      <div key={j.id} className={`space-y-1.5 rounded-xl border-2 p-3 ${late ? 'border-red-300 bg-red-50' : j.status === 'ready' ? 'border-green-300 bg-green-50' : j.status === 'done' ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
        <div className="flex flex-wrap items-center gap-x-2">
          <p className="text-sm font-extrabold text-gray-900">{j.customer}{j.customer_id ? <span className="ml-1 text-[11px] font-bold text-gray-500">{j.customer_id}</span> : null}</p>
          {j.phone && <a href={`tel:${j.phone}`} className="text-xs font-semibold text-blue-700 underline">{j.phone}</a>}
          <span className="text-[10px] font-bold text-gray-400">{jobNo(j.id)}</span>
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${j.status === 'ready' ? 'bg-green-600 text-white' : j.status === 'done' ? 'bg-gray-300 text-gray-800' : 'bg-amber-200 text-amber-900'}`}>{j.status === 'ready' ? 'Ready to collect' : j.status === 'done' ? 'Collected' : 'To be done'}</span>
        </div>
        {j.lines.length ? <ul className="text-sm text-gray-800">{j.lines.map((l, i) => <li key={i}>{l.qty} x {l.name} @ {money(l.price)} = {money(l.qty * l.price)}</li>)}</ul> : <p className="text-sm text-gray-800">{j.job}</p>}
        <p className="text-sm font-bold text-gray-900">{j.total > 0 ? <>Total {money(j.total)} · {j.prepaid ? <span className="text-green-700">paid in full in the Sales Log</span> : <>paid {money(j.paid)} · <span className={j.balance > 0.005 ? 'text-red-700' : 'text-green-700'}>{j.balance > 0.005 ? `balance ${money(j.balance)}` : 'fully paid'}</span></>}</> : null}</p>
        {j.note && <p className="text-xs text-gray-600">Note: {j.note}</p>}
        <p className="text-[11px] text-gray-500">Left {dlabel(j.left_on)}{days(j.left_on, t) > 0 ? ` (${days(j.left_on, t)} day${days(j.left_on, t) === 1 ? '' : 's'} ago)` : ' (today)'} · <b className={late ? 'text-red-700' : ''}>{dueTxt}</b>{j.status !== 'done' && !j.due_on ? '' : ''}{j.created_by ? ` · taken by ${j.created_by}` : ''}</p>
        <div className="flex flex-wrap gap-1.5">
          {j.status === 'pending' && <button type="button" onClick={async () => { if (await send('PATCH', '/api/pending-jobs', { id: j.id, status: 'ready' }, 'Marked ready to collect.') && j.phone) openWa(waOf({ ...j, status: 'ready' }, 'ready')) }} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Done: tell the customer</button>}
          {j.balance > 0.005 && <button type="button" onClick={() => setPay({ id: j.id, amount: String(j.balance), method: 'cash', refund: false })} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Take payment</button>}
          {j.status !== 'done' && <button type="button" onClick={() => void send('PATCH', '/api/pending-jobs', { id: j.id, status: 'done' }, j.balance > 0.005 ? 'Handed over. The balance stays on the Debtors list.' : 'Handed over.')} className="rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">Handed over</button>}
          {j.status === 'done' && <button type="button" onClick={() => void send('PATCH', '/api/pending-jobs', { id: j.id, status: 'pending' }, 'Reopened.')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">Reopen</button>}
          {j.phone && <button type="button" onClick={() => openWa(waOf(j, j.balance > 0.005 && j.status !== 'pending' ? 'reminder' : 'received'))} className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-900">WhatsApp</button>}
          <button type="button" onClick={() => { setEdit(edit === j.id ? null : j.id); setNote(j.note ?? '') }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">Note or date</button>
          {j.paid > 0.005 && !j.prepaid && <button type="button" onClick={() => setPay({ id: j.id, amount: '', method: 'cash', refund: true })} className="rounded-lg bg-orange-100 px-3 py-1.5 text-xs font-bold text-orange-900">Refund</button>}
          {canDelete && <button type="button" onClick={() => { if (confirm('Remove this job and its payments? Use this only for a job entered by mistake.')) void send('DELETE', '/api/pending-jobs', { id: j.id }, 'Removed.') }} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800">Remove</button>}
        </div>
        {pay?.id === j.id && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-2">
            <label className="text-[11px] font-semibold text-gray-700">{pay.refund ? 'Refund' : 'Amount'}<input type="number" step="0.01" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} className="mt-0.5 block w-28 rounded-lg border border-gray-300 p-1.5 text-sm" /></label>
            <select value={pay.method} onChange={e => setPay({ ...pay, method: e.target.value })} className="rounded-lg border border-gray-300 p-1.5 text-sm"><option value="cash">Cash</option><option value="momo">MoMo</option></select>
            <button type="button" onClick={async () => { const r = await send('POST', '/api/pending-jobs/payments', { job_id: j.id, amount: pay.amount, method: pay.method, kind: pay.refund ? 'refund' : 'balance' }, pay.refund ? 'Refund recorded.' : 'Payment recorded.'); if (r) setPay(null) }} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Record</button>
          </div>
        )}
        {edit === j.id && (
          <div className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-2">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="min-w-0 flex-1 rounded-lg border border-gray-300 p-1.5 text-sm" />
            <input type="date" defaultValue={j.due_on ?? ''} onChange={e => void send('PATCH', '/api/pending-jobs', { id: j.id, due_on: e.target.value }, 'Date changed.')} className="rounded-lg border border-gray-300 p-1.5 text-sm" />
            <button type="button" onClick={() => { void send('PATCH', '/api/pending-jobs', { id: j.id, note }, 'Note saved.'); setEdit(null) }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Save note</button>
          </div>
        )}
      </div>)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3 pb-24">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-extrabold text-[#14213D]">Pending jobs</h1>
        <button type="button" onClick={() => { setAdding(a => !a); setMade(null) }} className="rounded-xl bg-[#14213D] px-3 py-2 text-xs font-bold text-white">{adding ? 'Cancel' : '+ Customer left a job'}</button>
      </div>
      <p className="text-sm text-gray-700">Jobs customers leave behind. {jobs ? `${open.length} open${overdue ? `, ${overdue} overdue` : ''}. ${owing.length ? `${owing.length} customer job${owing.length === 1 ? '' : 's'} with a balance: ${money(owed)} owed.` : ''}` : ''}</p>
      {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {made && (
        <div className="space-y-1 rounded-xl border-2 border-green-300 bg-green-50 p-3">
          <p className="text-sm font-bold text-green-900">{jobNo(made.id)} is written down{made.total > 0 ? `: total ${money(made.total)}, paid ${money(made.prepaid ? made.total : made.paid)}, ${made.balance > 0.005 ? `balance ${money(made.balance)} (now on the Debtors list)` : 'nothing owed'}.` : '.'}</p>
          {made.phone && <button type="button" onClick={() => openWa(waOf(made, 'received'))} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white">Send the details on WhatsApp</button>}
        </div>
      )}
      {adding && (
        <div className="space-y-2 rounded-xl border border-gray-300 bg-white p-3">
          {form.prepaid && <p className="rounded-lg bg-blue-50 p-2 text-xs font-semibold text-blue-900">This sale is already paid in full in the Sales Log. Making it a pending job adds no money and nothing is owed.</p>}
          <div className="relative">
            <input value={custQ} onChange={e => { setCustQ(e.target.value); setForm(f => ({ ...f, customer: e.target.value, customer_id: '' })) }} placeholder="Customer: name or GM number" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
            {custs.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow">{custs.map(c => <button key={c.id} type="button" onClick={() => { setForm(f => ({ ...f, customer: c.display_name || c.company_name || '', customer_id: c.customer_id_code ?? '', phone: c.phone ?? f.phone })); setCustQ(c.display_name || c.company_name || ''); setCusts([]) }} className="block w-full px-2 py-1.5 text-left text-sm hover:bg-gray-100"><b>{c.display_name || c.company_name}</b> <span className="text-gray-500">{c.customer_id_code} {c.phone}</span></button>)}</div>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone (for WhatsApp)" inputMode="tel" className="rounded-lg border border-gray-300 p-2 text-sm" />
            <label className="text-[11px] font-semibold text-gray-700">Promised for<input type="date" min={t} value={form.due_on} onChange={e => setForm(f => ({ ...f, due_on: e.target.value }))} className="mt-0.5 block w-full rounded-lg border border-gray-300 p-1.5 text-sm" /></label>
          </div>
          {!form.prepaid && (
            <div className="relative">
              <input value={itemQ} onChange={e => setItemQ(e.target.value)} placeholder="Add an item or service (search)" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
              {items.length > 0 && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-300 bg-white shadow">{items.map(i => <button key={i.id} type="button" onClick={() => { setLines(l => [...l, { item_id: i.id, name: i.name, qty: 1, price: Number(i.selling_price) || 0 }]); setItemQ(''); setItems([]) }} className="flex w-full justify-between px-2 py-1.5 text-left text-sm hover:bg-gray-100"><span>{i.name}</span><span className="text-gray-500">{money(Number(i.selling_price) || 0)}</span></button>)}</div>}
            </div>
          )}
          {lines.map((l, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-gray-50 p-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate">{l.name}</span>
              <input type="number" min={1} value={l.qty} disabled={form.prepaid} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, qty: Number(e.target.value) } : x))} className="w-14 rounded border border-gray-300 p-1 text-center" />
              <span>x</span>
              <input type="number" step="0.01" value={l.price} disabled={form.prepaid} onChange={e => setLines(ls => ls.map((x, k) => k === i ? { ...x, price: Number(e.target.value) } : x))} className="w-20 rounded border border-gray-300 p-1 text-right" />
              {!form.prepaid && <button type="button" onClick={() => setLines(ls => ls.filter((_, k) => k !== i))} className="px-1 text-lg font-bold text-red-600">×</button>}
            </div>))}
          {total > 0 && <p className="text-sm font-bold text-gray-900">Total {money(total)}</p>}
          {!form.prepaid && (
            <div className="space-y-1 rounded-lg bg-amber-50 p-2">
              <p className="text-xs font-bold text-amber-900">Did the customer pay anything now?</p>
              <div className="flex items-center gap-2">
                <input type="number" step="0.01" min={0} value={form.deposit} onChange={e => setForm(f => ({ ...f, deposit: e.target.value }))} placeholder="Deposit (0 = none)" className="w-36 rounded-lg border border-gray-300 p-2 text-sm" />
                <select value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm"><option value="cash">Cash</option><option value="momo">MoMo</option></select>
              </div>
              {total > 0 && <p className="text-xs font-semibold text-amber-900">Paid now {money(dep)} · <b>left to pay {money(left)}</b>{left > 0.005 ? ' (goes on the Debtors list)' : ''}</p>}
            </div>
          )}
          <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note (optional)" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <button type="button" disabled={!form.customer.trim() || !form.phone.trim() || !lines.length} onClick={() => void add()} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">{form.prepaid ? 'Make it a pending job' : 'Write it down'}</button>
          <p className="text-[11px] text-gray-500">The customer and phone are needed so they can be messaged. Only the money taken now is added to today&apos;s sales total.</p>
        </div>
      )}
      <div className="flex flex-wrap gap-1">{TABS.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-xs font-bold ${tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label}{k === 'debt' && owing.length ? ` (${owing.length})` : ''}</button>)}</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a customer, GM number, phone or job" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
      {jobs === null && <p className="text-sm text-gray-400">Loading…</p>}
      {jobs && !shown.length && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{tab === 'debt' ? 'Nobody owes a balance.' : tab === 'done' ? 'Nothing handed over in the last 30 days.' : 'No jobs here.'}</p>}
      {tab === 'debt'
        ? byCustomer.map(group => (
            <div key={group[0].id} className="space-y-1.5 rounded-xl border-2 border-red-200 bg-red-50/40 p-2">
              <p className="px-1 text-sm font-extrabold text-red-800">{group[0].customer}{group[0].customer_id ? ` · ${group[0].customer_id}` : ''} owes {money(group.reduce((s, j) => s + j.balance, 0))}</p>
              {group.map(card)}
            </div>))
        : shown.map(card)}
    </div>
  )
}

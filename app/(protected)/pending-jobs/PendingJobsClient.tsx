'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PendingJob } from '@/lib/pendingJobs'

const today = () => new Date().toISOString().slice(0, 10)
const days = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000)
const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const TABS = [['open', 'Open'], ['ready', 'Ready to collect'], ['done', 'Collected'], ['all', 'All']] as const

// Pending jobs: the jobs customers leave behind. Any logged-in staff member writes, finishes and hands over jobs here.
export default function PendingJobsClient({ canDelete }: { canDelete: boolean }) {
  const [jobs, setJobs] = useState<PendingJob[] | null>(null)
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('open')
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ customer: '', phone: '', job: '', due_on: '', note: '' })
  const [edit, setEdit] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState('')
  const load = useCallback(() => fetch('/api/pending-jobs?status=all', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => setJobs(d?.jobs ?? [])).catch(() => setJobs([])), [])
  useEffect(() => { void load() }, [load])
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  async function send(method: string, body: object, ok: string) {
    const r = await fetch('/api/pending-jobs', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({}))
    if (!r.ok) { flash(j.error ?? 'Failed'); return false }
    flash(ok); void load(); return true
  }
  async function add() { if (await send('POST', form, 'Job written down.')) { setForm({ customer: '', phone: '', job: '', due_on: '', note: '' }); setAdding(false) } }
  const t = today()
  const open = (jobs ?? []).filter(j => j.status !== 'done')
  const overdue = open.filter(j => j.due_on && j.due_on < t).length
  const shown = useMemo(() => (jobs ?? []).filter(j => (tab === 'all' || (tab === 'open' ? j.status !== 'done' : j.status === tab)) && (!q.trim() || `${j.customer} ${j.phone ?? ''} ${j.job} ${j.note ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))), [jobs, tab, q])
  return (
    <div className="mx-auto max-w-2xl space-y-2 p-3 pb-24">
      <div className="flex items-center gap-2">
        <h1 className="mr-auto text-xl font-extrabold text-[#14213D]">Pending jobs</h1>
        <button type="button" onClick={() => setAdding(a => !a)} className="rounded-xl bg-[#14213D] px-3 py-2 text-xs font-bold text-white">{adding ? 'Cancel' : '+ Customer left a job'}</button>
      </div>
      <p className="text-sm text-gray-700">Jobs customers leave behind: to be done, or done and waiting to be collected. {jobs ? `${open.length} open${overdue ? `, ${overdue} overdue` : ''}.` : ''}</p>
      {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {adding && (
        <div className="space-y-2 rounded-xl border border-gray-300 bg-white p-3">
          <div className="grid grid-cols-2 gap-2">
            <input value={form.customer} onChange={e => setForm(f => ({ ...f, customer: e.target.value }))} placeholder="Customer (name or GM number)" className="rounded-lg border border-gray-300 p-2 text-sm" />
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="Phone" inputMode="tel" className="rounded-lg border border-gray-300 p-2 text-sm" />
          </div>
          <textarea value={form.job} onChange={e => setForm(f => ({ ...f, job: e.target.value }))} rows={2} placeholder="What did they leave, and what is to be done?" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-[11px] font-semibold text-gray-700">Promised for<input type="date" min={t} value={form.due_on} onChange={e => setForm(f => ({ ...f, due_on: e.target.value }))} className="mt-0.5 w-full rounded-lg border border-gray-300 p-1.5 text-sm" /></label>
            <label className="text-[11px] font-semibold text-gray-700">Note<input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="optional" className="mt-0.5 w-full rounded-lg border border-gray-300 p-2 text-sm" /></label>
          </div>
          <button type="button" disabled={!form.customer.trim() || !form.job.trim()} onClick={() => void add()} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">Write it down</button>
        </div>
      )}
      <div className="flex flex-wrap gap-1">{TABS.map(([k, label]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-xs font-bold ${tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>)}</div>
      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a customer, phone or job" className="w-full rounded-xl border border-gray-300 p-2.5 text-sm" />
      {jobs === null && <p className="text-sm text-gray-400">Loading…</p>}
      {jobs && !shown.length && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">{tab === 'done' ? 'Nothing handed over in the last 30 days.' : 'No jobs here.'}</p>}
      {shown.map(j => {
        const late = j.status !== 'done' && j.due_on && j.due_on < t
        const dueTxt = j.due_on ? (j.due_on === t ? 'Due today' : late ? `Overdue ${days(j.due_on, t)} day${days(j.due_on, t) === 1 ? '' : 's'}` : `Due ${dlabel(j.due_on)}`) : 'No date promised'
        return (
          <div key={j.id} className={`space-y-1.5 rounded-xl border-2 p-3 ${late ? 'border-red-300 bg-red-50' : j.status === 'ready' ? 'border-green-300 bg-green-50' : j.status === 'done' ? 'border-gray-200 bg-gray-50' : 'border-gray-200 bg-white'}`}>
            <div className="flex flex-wrap items-center gap-x-2">
              <p className="text-sm font-extrabold text-gray-900">{j.customer}</p>
              {j.phone && <a href={`tel:${j.phone}`} className="text-xs font-semibold text-blue-700 underline">{j.phone}</a>}
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${j.status === 'ready' ? 'bg-green-600 text-white' : j.status === 'done' ? 'bg-gray-300 text-gray-800' : 'bg-amber-200 text-amber-900'}`}>{j.status === 'ready' ? 'Ready to collect' : j.status === 'done' ? 'Collected' : 'To be done'}</span>
            </div>
            <p className="text-sm text-gray-800">{j.job}</p>
            {j.note && <p className="text-xs text-gray-600">Note: {j.note}</p>}
            <p className="text-[11px] text-gray-500">Left {dlabel(j.left_on)}{days(j.left_on, t) > 0 ? ` (${days(j.left_on, t)} day${days(j.left_on, t) === 1 ? '' : 's'} ago)` : ' (today)'} · <b className={late ? 'text-red-700' : ''}>{dueTxt}</b>{j.created_by ? ` · taken by ${j.created_by}` : ''}</p>
            <div className="flex flex-wrap gap-1.5">
              {j.status === 'pending' && <button type="button" onClick={() => void send('PATCH', { id: j.id, status: 'ready' }, 'Marked ready to collect.')} className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Done: ready to collect</button>}
              {j.status !== 'done' && <button type="button" onClick={() => void send('PATCH', { id: j.id, status: 'done' }, 'Handed over.')} className="rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">Handed over</button>}
              {j.status === 'done' && <button type="button" onClick={() => void send('PATCH', { id: j.id, status: 'pending' }, 'Reopened.')} className="rounded-lg bg-gray-200 px-3 py-1.5 text-xs font-bold text-gray-800">Reopen</button>}
              <button type="button" onClick={() => { setEdit(edit === j.id ? null : j.id); setNote(j.note ?? '') }} className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-bold text-gray-700">Note or date</button>
              {canDelete && <button type="button" onClick={() => { if (confirm('Remove this job? Use this only for a job entered by mistake.')) void send('DELETE', { id: j.id }, 'Removed.') }} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800">Remove</button>}
            </div>
            {edit === j.id && (
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-white p-2">
                <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note" className="min-w-0 flex-1 rounded-lg border border-gray-300 p-1.5 text-sm" />
                <input type="date" defaultValue={j.due_on ?? ''} onChange={e => void send('PATCH', { id: j.id, due_on: e.target.value }, 'Date changed.')} className="rounded-lg border border-gray-300 p-1.5 text-sm" />
                <button type="button" onClick={() => { void send('PATCH', { id: j.id, note }, 'Note saved.'); setEdit(null) }} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white">Save note</button>
              </div>
            )}
          </div>)
      })}
    </div>
  )
}

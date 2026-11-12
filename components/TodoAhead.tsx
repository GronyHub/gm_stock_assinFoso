'use client'
import { useCallback, useEffect, useState } from 'react'
import type { AheadDay, AheadItem } from '@/lib/todoAhead'
import { shortTitle } from '@/lib/dailyChecksShared'

const FILTERS = [['', 'Everything'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly'], ['oneoff', 'One-off']] as const
const BANDS: { key: AheadItem['band']; label: string }[] = [{ key: 'opener', label: 'Opener' }, { key: 'daytime', label: 'Daytime' }, { key: 'closer', label: 'Closer' }, { key: 'oneoff', label: 'To do items' }]
const nm = (n: string | null) => (n ? n.charAt(0).toUpperCase() + n.slice(1) : '')
const dateLabel = (d: string) => {
  const t = new Date(); t.setUTCHours(0, 0, 0, 0)
  const diff = Math.round((new Date(d + 'T00:00:00Z').getTime() - t.getTime()) / 86400000)
  const full = new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return diff === 1 ? `Tomorrow · ${full}` : full
}
// Opens another page in the Shop (the hub's right pane) from inside this frame.
const go = (path: string) => { if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }

// The days ahead, like the Home feed: each date with its Opener, Daytime and Closer duties (named from the rota), the weekly and monthly laws on their
// days, and the one-off to-do items added for it. The filters on top narrow it.
export default function TodoAhead() {
  const [days, setDays] = useState<AheadDay[]>([])
  const [filter, setFilter] = useState('')
  const [canAdd, setCanAdd] = useState(false)
  const [people, setPeople] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', who: '', notes: '' })
  const [msg, setMsg] = useState('')
  const load = useCallback(async (from?: string, append = false) => {
    setLoading(true)
    try {
      const r = await fetch('/api/todo?days=31' + (from ? `&from=${from}` : ''), { cache: 'no-store' }); const j = await r.json()
      if (r.ok) { setDays(prev => append ? [...prev, ...j.days] : j.days); setCanAdd(!!j.canAdd); setPeople(j.people ?? []) }
    } catch { /* shown empty */ }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])
  async function add() {
    const r = await fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? 'Added.' : (j.error ?? 'Could not add.')); setTimeout(() => setMsg(''), 3500)
    if (r.ok) { setForm({ title: '', date: '', who: '', notes: '' }); setAdding(false); void load() }
  }
  const keep = (i: AheadItem) => !filter || (filter === 'oneoff' ? i.kind === 'oneoff' : i.freq === filter)
  const shown = days.map(d => ({ ...d, items: d.items.filter(keep) })).filter(d => d.items.length)
  const minDate = new Date().toISOString().slice(0, 10)
  // One date open at a time: the one tapped in the strip (the first day by default).
  const [sel, setSel] = useState('')
  const cur = shown.find(d => d.date === sel) ?? shown[0]
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="mr-auto text-base font-extrabold text-[#14213D]">Coming up</h2>
        {canAdd && <button type="button" onClick={() => setAdding(a => !a)} className="rounded-lg bg-[#14213D] px-3 py-1.5 text-xs font-bold text-white">{adding ? 'Cancel' : '+ Add to do'}</button>}
      </div>
      {msg && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {adding && (
        <div className="space-y-2 rounded-xl border border-gray-300 bg-white p-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What has to be done?" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" min={minDate} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm" />
            <select value={form.who} onChange={e => setForm(f => ({ ...f, who: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm"><option value="">Everyone</option>{people.map(p => <option key={p} value={p}>{nm(p)}</option>)}</select>
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes, so they can prepare (optional)" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <button type="button" disabled={!form.title.trim() || !form.date} onClick={() => void add()} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">Add to the list</button>
        </div>
      )}
      <div className="flex flex-wrap gap-1">{FILTERS.map(([k, label]) => <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full px-3 py-1 text-xs font-bold ${filter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>)}</div>
      {shown.length > 0 && (
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Pick a date">
          {shown.map(d => { const dt = new Date(d.date + 'T00:00:00Z'); const on = cur?.date === d.date
            return (
              <button key={d.date} type="button" role="tab" aria-selected={on} onClick={() => setSel(d.date)} title={dateLabel(d.date)}
                className={`flex w-9 shrink-0 select-none flex-col items-center rounded-md border py-0.5 leading-none ${on ? 'border-[#14213D] bg-[#14213D] text-white' : 'border-gray-300 bg-white text-gray-800'}`}>
                <span className={`text-[7px] font-bold uppercase ${on ? 'text-blue-200' : 'text-gray-500'}`}>{dt.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })}</span>
                <span className="text-[13px] font-extrabold">{dt.getUTCDate()}</span>
                <span className={`text-[7px] font-bold ${on ? 'text-blue-200' : 'text-gray-400'}`}>{dt.toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' })}</span>
              </button>) })}
        </div>)}
      {cur && (
        <div key={cur.date} className="rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap items-center gap-x-3 rounded-t-xl bg-[#14213D] px-3 py-1.5 text-white">
            <p className="text-sm font-bold">{dateLabel(cur.date)}</p>
            {cur.rota && <p className="text-[11px] text-blue-200">{cur.rota.opener ? `Opener ${nm(cur.rota.opener)}` : ''}{cur.rota.opener && cur.rota.closer ? ' · ' : ''}{cur.rota.closer ? `Closer ${nm(cur.rota.closer)}` : ''}</p>}
          </div>
          <div className="space-y-2 p-2">
            {BANDS.map(b => { const rows = cur.items.filter(i => i.band === b.key); if (!rows.length) return null; return (
              <div key={b.key}>
                <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-gray-500">{b.label}</p>
                <div className="grid grid-cols-6 gap-1">{rows.map(i => {
                  const who = (i.role && i.who ? `${i.role} · ${nm(i.who)}` : i.role ?? nm(i.who)) || 'Everyone'
                  return (
                    <button key={i.key} type="button" title={`${i.title}${i.note ? ' — ' + i.note : ''}`} onClick={() => { if (i.law_id) go(`/laws?law=${i.law_id}`) }}
                      className={`flex min-h-[4rem] select-none flex-col items-start justify-start gap-px rounded-md border px-1 py-0.5 text-left active:opacity-70 ${i.kind === 'oneoff' ? 'border-indigo-300 bg-indigo-50' : i.freq !== 'daily' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}`}>
                      <span className="text-[8px] font-extrabold leading-none text-gray-500">{i.time ?? (i.freq !== 'daily' ? i.freq : '')}</span>
                      <span className="line-clamp-3 break-words text-[8px] font-semibold leading-[1.1] text-gray-900">{shortTitle(i.title)}</span>
                      {who && <span className="mt-auto w-full truncate text-[7px] font-bold leading-tight text-indigo-800">{who}</span>}
                    </button>)
                })}</div>
              </div>) })}
          </div>
        </div>)}
      {!loading && !shown.length && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Nothing {filter ? 'of that kind ' : ''}in the coming days.</p>}
      {loading && <p className="text-sm text-gray-400">Loading…</p>}
      {!loading && days.length > 0 && <button type="button" onClick={() => void load(new Date(new Date(days[days.length - 1].date + 'T00:00:00Z').getTime() + 86400000).toISOString().slice(0, 10), true)} className="w-full rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700">Show 31 more days</button>}
    </div>
  )
}

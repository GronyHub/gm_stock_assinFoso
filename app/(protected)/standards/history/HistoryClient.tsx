'use client'
import { useCallback, useEffect, useState } from 'react'
import { addDays, dayKey } from '@/lib/dailyChecksShared'

type Ev = { id: number; day: string; recorded_at: string; recorded_by: string; value: string; note: string | null; extra: { answer?: string; persons?: Record<string, string>; about_staff?: string; photo_url?: string; done_at?: string } | null; tile_id: number; title: string; icon: string; section: string; kind: string }
type Sum = { tile_id: number; title: string; icon: string; section: string; kind: string; times_done: number; last_done: string | null; last_by: string | null }
type Data = { from: string; to: string; events: Ev[]; summary: Sum[]; sections: string[]; people: string[] }
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const cap = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
const dlabel = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const sel = 'rounded-lg border border-gray-300 bg-white p-1.5 text-xs'

// The checklist's history: which tasks were done on which days, by whom and at what time, with what they answered.
export default function HistoryClient() {
  const today = dayKey()
  const [from, setFrom] = useState(addDays(today, -13))
  const [to, setTo] = useState(today)
  const [section, setSection] = useState('')
  const [person, setPerson] = useState('')
  const [q, setQ] = useState('')
  const [issues, setIssues] = useState(false)
  const [view, setView] = useState<'days' | 'tasks'>('days')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const p = new URLSearchParams({ from, to, section, person, q, issues: issues ? '1' : '0' })
    try {
      const r = await fetch(`/api/daily-checks/history?${p}`, { cache: 'no-store' }); const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Could not load'); setData(d); setError('')
    } catch (e) { setError((e as Error).message) }
  }, [from, to, section, person, q, issues])
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t) }, [load])

  const byDay = new Map<string, Ev[]>()
  for (const e of data?.events ?? []) { if (!byDay.has(e.day)) byDay.set(e.day, []); byDay.get(e.day)!.push(e) }

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/standards" className="text-sm text-gray-500">&larr; Checklist</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Checklist History</h1>
        <a href="/standards/manage" className="text-xs font-semibold text-blue-700 underline">Manage tiles</a>
      </div>
      <div className="mb-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <label className="text-[10px] font-bold uppercase text-gray-500">From<input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className={sel + ' block w-full'} /></label>
        <label className="text-[10px] font-bold uppercase text-gray-500">To<input type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} className={sel + ' block w-full'} /></label>
        <label className="text-[10px] font-bold uppercase text-gray-500">Group<select value={section} onChange={e => setSection(e.target.value)} className={sel + ' block w-full'}><option value="">All groups</option>{data?.sections.map(s => <option key={s}>{s}</option>)}</select></label>
        <label className="text-[10px] font-bold uppercase text-gray-500">Done by<select value={person} onChange={e => setPerson(e.target.value)} className={sel + ' block w-full'}><option value="">Anyone</option>{data?.people.map(s => <option key={s} value={s}>{cap(s)}</option>)}</select></label>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search a task or note, e.g. arrangement, security" className="min-w-[10rem] flex-1 rounded-lg border border-gray-300 p-1.5 text-xs" />
        <label className="flex items-center gap-1 text-xs font-semibold"><input type="checkbox" checked={issues} onChange={e => setIssues(e.target.checked)} /> Problems only</label>
        {(['days', 'tasks'] as const).map(v => <button key={v} type="button" onClick={() => setView(v)} className={`rounded-full px-3 py-1 text-xs font-bold ${view === v ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{v === 'days' ? 'By day' : 'By task'}</button>)}
        {[7, 30, 90].map(n => <button key={n} type="button" onClick={() => { setTo(today); setFrom(addDays(today, -(n - 1))) }} className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-700">Last {n} days</button>)}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data && !error && <p className="text-sm text-gray-400">Loading…</p>}

      {data && view === 'days' && (<>
        <p className="mb-1 text-[11px] text-gray-500">{data.events.length} record{data.events.length === 1 ? '' : 's'}{data.events.length >= 400 ? ' (showing the latest 400, narrow the dates)' : ''} from {dlabel(data.from)} to {dlabel(data.to)}</p>
        {[...byDay.entries()].map(([day, evs]) => (
          <div key={day} className="mb-3">
            <p className="mb-1 text-xs font-extrabold uppercase text-[#14213D]">{dlabel(day)} · {evs.length}</p>
            <div className="space-y-1">
              {evs.map(e => {
                const flagged = e.extra?.answer === 'issue' || Object.values(e.extra?.persons ?? {}).includes('not')
                return (
                  <div key={e.id} className={`rounded-lg border px-2 py-1.5 ${e.value === 'Not done' ? 'border-gray-300 bg-gray-100' : flagged ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-white'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg leading-none">{e.icon}</span>
                      <p className="line-clamp-2 flex-1 text-[12px] font-semibold leading-tight text-gray-900">{e.title}</p>
                      <span className="shrink-0 text-[10px] font-bold text-gray-500">{e.extra?.done_at ?? hhmm(e.recorded_at)} · {cap(e.recorded_by)}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{e.section}{e.value === 'Not done' ? ' · marked NOT done' : ''}</p>
                    {e.extra?.answer === 'ok' && <p className="text-[11px] font-semibold text-green-700">All good, nothing to report</p>}
                    {e.extra?.answer === 'issue' && <p className="text-[11px] font-semibold text-orange-700">Reported{e.extra.about_staff ? ` about ${cap(e.extra.about_staff)}` : ''}</p>}
                    {e.extra?.persons && <p className="text-[11px] text-gray-700">{Object.entries(e.extra.persons).map(([n, v]) => `${v === 'ok' ? '✓' : '✗'} ${cap(n)}`).join('   ')}</p>}
                    {e.note && <p className="text-[11px] text-gray-800">{e.note}</p>}
                    {e.extra?.photo_url && <a href={e.extra.photo_url} target="_blank" rel="noopener noreferrer"><img src={e.extra.photo_url} alt="" className="mt-1 h-16 w-16 rounded-lg border border-gray-200 object-cover" /></a>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        {data.events.length === 0 && <p className="text-sm text-gray-400">Nothing recorded for these filters.</p>}
      </>)}

      {data && view === 'tasks' && (
        <div className="space-y-1">
          <p className="mb-1 text-[11px] text-gray-500">How often each task was done between {dlabel(data.from)} and {dlabel(data.to)}, and when it was last done.</p>
          {data.summary.map(s => (
            <button key={s.tile_id} type="button" onClick={() => { setQ(s.title.slice(0, 40)); setView('days') }} className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left ${s.times_done === 0 ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}>
              <span className="text-lg leading-none">{s.icon}</span>
              <span className="min-w-0 flex-1"><span className="line-clamp-2 block text-[12px] font-semibold leading-tight text-gray-900">{s.title}</span><span className="block text-[10px] text-gray-500">{s.section}</span></span>
              <span className="shrink-0 text-right text-[10px] font-bold text-gray-600">{s.times_done}× done<br />{s.last_done ? `last ${dlabel(s.last_done)} · ${cap(s.last_by ?? '')}` : 'not in this period'}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

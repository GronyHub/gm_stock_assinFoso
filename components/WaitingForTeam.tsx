'use client'
import { useCallback, useEffect, useState } from 'react'
import type { AheadDay, AheadItem } from '@/lib/todoAhead'
import { addDays, CHECKLIST_START } from '@/lib/dailyChecksShared'
import DailyChecklistClient from '@/app/(protected)/standards/DailyChecklistClient'
import ClockApprovals from '@/components/ClockApprovals'
import PendingJobsDue from '@/components/PendingJobsDue'
import DateStrip from '@/components/DateStrip'
import TaskTile, { DensityToggle, tileGrid, useTileDensity } from '@/components/TaskTile'
import { LAW_TYPES } from '@/lib/lawCategories'

const BANDS: { key: AheadItem['band']; label: string }[] = [{ key: 'opener', label: 'Opener' }, { key: 'daytime', label: 'Daytime' }, { key: 'closer', label: 'Closer' }, { key: 'oneoff', label: 'To do items' }]
const nm = (n: string | null) => (n ? n.charAt(0).toUpperCase() + n.slice(1) : '')
// Opens another page in the Shop (the hub's right pane) from inside this frame.
const go = (path: string) => { if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }
const todayKey = () => new Date().toISOString().slice(0, 10)

// The Shop's first tab. One strip of small date tiles runs across the top (earlier days to the left, today, then the days ahead); the page below
// holds only what belongs to the chosen date: today's live list, an earlier day's record, or a coming day's planned tasks (named from the rota).
export default function WaitingForTeam({ canManage }: { canManage: boolean }) {
  const today = todayKey()
  const [density, setDensity] = useTileDensity()
  const [sel, setSel] = useState(today)
  const [days, setDays] = useState<AheadDay[]>([])
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
  // Earlier days (from the day the checklist began), today, then the days the server planned.
  const past: string[] = []
  for (let d = addDays(today, -1); d >= CHECKLIST_START && past.length < 60; d = addDays(d, -1)) past.unshift(d)
  const dates = [...past, today, ...days.map(d => d.date).filter(d => d > today)]
  const curDay = days.find(d => d.date === sel)
  const minDate = today
  const more = () => { const last = days[days.length - 1]?.date; if (last) void load(addDays(last, 1), true) }
  return (
    <div className="pb-24 pt-2">
      <div className="flex items-start gap-2 px-3">
        <DateStrip dates={dates} sel={sel} today={today} onSel={setSel} more={days.length > 0 ? more : undefined} />
        <DensityToggle density={density} onChange={setDensity} />
        {canAdd && <button type="button" onClick={() => setAdding(a => !a)} title="Add a to-do for a date" className="shrink-0 rounded-lg bg-[#14213D] px-2.5 py-2 text-xs font-bold text-white">{adding ? '✕' : '+ To do'}</button>}
      </div>
      {msg && <p className="mx-3 mt-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {adding && (
        <div className="mx-3 mt-2 space-y-2 rounded-xl border border-gray-300 bg-white p-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What has to be done?" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" min={minDate} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm" />
            <select value={form.who} onChange={e => setForm(f => ({ ...f, who: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm"><option value="">Everyone</option>{people.map(p => <option key={p} value={p}>{nm(p)}</option>)}</select>
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes, so they can prepare (optional)" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <button type="button" disabled={!form.title.trim() || !form.date} onClick={() => void add()} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">Add to the list</button>
        </div>
      )}
      <div className="mt-2">
        {sel <= today
          ? <DailyChecklistClient key={sel} canManage={canManage} embedded density={density} dayParam={sel === today ? null : sel}
              extras={<>{canManage && <ClockApprovals density={density} />}<PendingJobsDue density={density} /></>} />
          : (
            <div className="space-y-2 px-3">
              {loading && !curDay && <p className="text-sm text-gray-400">Loading…</p>}
              {!loading && !curDay && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Nothing is planned for this day.</p>}
              {curDay && BANDS.map(b => { const rows = curDay.items.filter(i => i.band === b.key); if (!rows.length) return null; return (
                <div key={b.key}>
                  <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-gray-500">{b.label}</p>
                  <div className={tileGrid(density)}>{rows.map(i => {
                    const who = (i.role && i.who ? `${i.role} · ${nm(i.who)}` : i.role ?? nm(i.who)) || 'Everyone'
                    return <TaskTile key={i.key} density={density} time={i.time ?? (i.freq !== 'daily' ? i.freq : null)} title={i.title} who={who} category={i.category} type={i.kind === 'oneoff' ? 'One-off' : LAW_TYPES.find(x => x.key === i.lawType)?.label}
                      detail={i.note} tone={i.kind === 'oneoff' ? 'border-indigo-300 bg-indigo-50' : i.freq !== 'daily' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'} onClick={() => { if (i.law_id) go(`/laws?law=${i.law_id}`) }} />
                  })}</div>
                </div>) })}
            </div>)}
      </div>
    </div>
  )
}

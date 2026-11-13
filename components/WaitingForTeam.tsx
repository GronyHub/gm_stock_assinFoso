'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Duty } from '@/lib/duties'
import { addDays, CHECKLIST_START } from '@/lib/dailyChecksShared'
import DailyChecklistClient from '@/app/(protected)/standards/DailyChecklistClient'
import ClockApprovals from '@/components/ClockApprovals'
import PendingJobsDue from '@/components/PendingJobsDue'
import { fallsOn } from '@/lib/dutyFilter'
import ClockNotices from '@/components/ClockNotices'
import PenaltyDecisions from '@/components/PenaltyDecisions'
import DateStrip from '@/components/DateStrip'
import TaskTile, { DensityToggle, tileGrid, useTileDensity } from '@/components/TaskTile'
import { LAW_TYPES } from '@/lib/lawCategories'
import { ACTIVE_STAFF } from '@/lib/staffList'

const BANDS: { key: string; label: string; test: (d: Duty) => boolean }[] = [
  { key: 'opener', label: 'Opener', test: d => d.role === 'Opener' },
  { key: 'daytime', label: 'Daytime', test: d => (d.kind === 'task' || d.kind === 'periodic') && d.role !== 'Opener' && d.role !== 'Closer' },
  { key: 'closer', label: 'Closer', test: d => d.role === 'Closer' },
  { key: 'oneoff', label: 'To do items', test: d => d.kind === 'oneoff' || d.kind === 'job' },
  { key: 'standing', label: 'Standing duties', test: d => d.kind === 'standing' },
]
const nm = (n: string | null) => (n ? n.charAt(0).toUpperCase() + n.slice(1) : '')
// Opens another page in the Shop (the hub's right pane) from inside this frame.
const go = (path: string) => { if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }
const todayKey = () => new Date().toISOString().slice(0, 10)

// The Shop's first tab. One strip of small date tiles runs across the top (earlier days to the left, today, then the days ahead); the page below
// holds only what belongs to the chosen date: today's live list, an earlier day's record, or a coming day's planned tasks (named from the rota).
export default function WaitingForTeam({ canManage }: { canManage: boolean }) {
  const today = todayKey()
  const [density, setDensity] = useTileDensity()
  // Filter by person: on Today anyone can; on other dates only the people the signed-in supervisor may look at.
  const [who, setWho] = useState('')
  const [viewable, setViewable] = useState<string[]>([])
  const [self, setSelf] = useState('')
  useEffect(() => { fetch('/api/my-day?people=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { setViewable(Array.isArray(d?.people) ? d.people : []); setSelf(String(d?.self ?? '')) }).catch(() => {}) }, [])
  // Staff open this page on their own name; the owner and Joe start on Everyone. (Waiting for me is this page filtered to one person, so there is no separate list to keep in step.)
  const whoTouched = useRef(false)
  useEffect(() => { if (!canManage && self && !whoTouched.current) setWho(self) }, [canManage, self])
  const [refresh, setRefresh] = useState(0)
  // A tap on a clock/question/approval duty tile: show the person's own cards (chip = Everyone for a manager, else their own name), then scroll to them.
  useEffect(() => {
    const f = (e: Event) => {
      const what = String((e as CustomEvent).detail ?? '')
      whoTouched.current = true; setWho(canManage ? '' : self); setSel(today)
      setTimeout(() => {
        if (what === 'approve') window.dispatchEvent(new CustomEvent('wft-focus-ready', { detail: 'approve' }))
        else { const el = document.getElementById('wft-cards'); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('ring-4', 'ring-blue-500'); setTimeout(() => el.classList.remove('ring-4', 'ring-blue-500'), 4000) } }
      }, 350)
    }
    window.addEventListener('wft-focus', f); return () => window.removeEventListener('wft-focus', f)
  }, [canManage, self, today])
  const [sel, setSel] = useState(today)
  const [ahead, setAhead] = useState(31)
  const [fduties, setFduties] = useState<Duty[] | null>(null)
  const [canAdd, setCanAdd] = useState(false)
  const [people, setPeople] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title: '', date: '', who: '', notes: '' })
  const [msg, setMsg] = useState('')
  // Who may add a to-do, and who can be picked (the to-do route answers this with tomorrow's page).
  const load = useCallback(async () => {
    try { const r = await fetch('/api/todo?days=1', { cache: 'no-store' }); const j = await r.json(); if (r.ok) { setCanAdd(!!j.canAdd); setPeople(j.people ?? []) } } catch { /* hidden */ }
  }, [])
  useEffect(() => { void load() }, [load])
  // A coming day's duties come from the same calculation as today's and earlier days.
  useEffect(() => {
    if (sel <= today) return
    let live = true; setFduties(null)
    fetch(`/api/duties?date=${sel}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { if (live) setFduties(d?.duties ?? []) }).catch(() => { if (live) setFduties([]) })
    return () => { live = false }
  }, [sel, today])
  async function add() {
    const r = await fetch('/api/todo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const j = await r.json().catch(() => ({}))
    setMsg(r.ok ? 'Added.' : (j.error ?? 'Could not add.')); setTimeout(() => setMsg(''), 3500)
    if (r.ok) { setForm({ title: '', date: '', who: '', notes: '' }); setAdding(false); void load() }
  }
  // Earlier days (from the day the checklist began), today, then the days the server planned.
  const past: string[] = []
  for (let d = addDays(today, -1); d >= CHECKLIST_START && past.length < 60; d = addDays(d, -1)) past.unshift(d)
  const dates = [...past, today, ...Array.from({ length: ahead }, (_, i) => addDays(today, i + 1))]
  // Everyone who can have a duty gets a chip: on Today every active person (the owner has decisions and approvals too); on other dates you and the people you may look at.
  const chipNames = sel === today ? [...ACTIVE_STAFF] : ACTIVE_STAFF.filter(n => n === self || viewable.includes(n))
  const person = who && chipNames.includes(who) ? who : ''
  // With a person chosen, only what falls on them (and what is for everyone).
  const mine = (d: Duty) => fallsOn(d, person)
  const minDate = today
  const more = () => setAhead(a => a + 31)
  return (
    <div className="-mx-2 -mt-3 pb-24 pt-1">
      <div className="sticky top-0 z-20 bg-white pb-1">   {/* the date strip and the staff chips stay on screen while the tiles scroll under them */}
      <div className="flex items-start gap-1 px-2">
        <DateStrip dates={dates} sel={sel} today={today} onSel={setSel} more={more} />
        <DensityToggle density={density} onChange={setDensity} />
        {canAdd && <button type="button" onClick={() => setAdding(a => !a)} title="Add a to-do for a date" className="shrink-0 rounded-lg bg-[#14213D] px-2 py-1.5 text-[11px] font-bold text-white">{adding ? '✕' : '+ To do'}</button>}
      </div>
      {chipNames.length > 0 && (
        <div className="mt-0.5 flex flex-nowrap gap-1 overflow-x-auto px-2">
          {['', ...chipNames].map(n => (
            <button key={n || 'all'} type="button" onClick={() => { whoTouched.current = true; setWho(n) }} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${person === n ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{n ? nm(n) : 'Everyone'}</button>
          ))}
        </div>)}
      </div>
      {msg && <p className="mx-2 mt-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {adding && (
        <div className="mx-2 mt-2 space-y-2 rounded-xl border border-gray-300 bg-white p-3">
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="What has to be done?" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" min={minDate} value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm" />
            <select value={form.who} onChange={e => setForm(f => ({ ...f, who: e.target.value }))} className="rounded-lg border border-gray-300 p-2 text-sm"><option value="">Everyone</option>{people.map(p => <option key={p} value={p}>{nm(p)}</option>)}</select>
          </div>
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Notes, so they can prepare (optional)" className="w-full rounded-lg border border-gray-300 p-2 text-sm" />
          <button type="button" disabled={!form.title.trim() || !form.date} onClick={() => void add()} className="w-full rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">Add to the list</button>
        </div>
      )}
      {/* The answers that belong to the signed-in person (a missing clock time, a supervisor's question, a decision) sit here, on this page, when their own name (or Everyone) is in focus. */}
      {sel === today && (!person || person === self) && <div id="wft-cards" className="mt-2 space-y-2 rounded-xl px-2 empty:hidden"><ClockNotices onChange={() => setRefresh(n => n + 1)} /><PenaltyDecisions onChange={() => setRefresh(n => n + 1)} />{canManage && <div className={tileGrid(density)}><ClockApprovals density={density} /></div>}</div>}
      <div className="mt-2">
        {sel <= today
          ? <DailyChecklistClient key={`${sel}-${refresh}`} canManage={canManage} embedded density={density} person={person} dayParam={sel === today ? null : sel}
              extras={<PendingJobsDue density={density} />} />
          : (
            <div className="space-y-1 px-2">
              {fduties === null && <p className="text-sm text-gray-400">Loading…</p>}
              {fduties && fduties.filter(mine).length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Nothing is planned for {person ? nm(person) : 'this day'}.</p>}
              {fduties && BANDS.map(b => { const rows = fduties.filter(mine).filter(d => b.test(d)); if (!rows.length) return null; return (
                <div key={b.key}>
                  <p className="mb-0.5 text-[10px] font-extrabold uppercase tracking-wide text-gray-500">{b.label}</p>
                  <div className={tileGrid(density)}>{rows.map(d => {
                    const whoL = (d.role && d.role !== 'Joe' ? `${d.role}${d.owner ? ` · ${nm(d.owner)}` : ''}` : d.owner ? nm(d.owner) : d.role ?? 'Everyone')
                    return <TaskTile key={d.key} density={density} time={d.kind === 'task' ? `${String(Math.floor(d.due / 60)).padStart(2, '0')}:${String(d.due % 60).padStart(2, '0')}` : d.time || undefined} title={d.title} who={whoL} category={d.category} type={d.typeLabel ?? LAW_TYPES.find(x => x.key === d.lawType)?.label}
                      badge={d.count} detail={d.detail ?? d.note} tone={d.kind === 'oneoff' || d.kind === 'job' ? 'border-indigo-300 bg-indigo-50' : d.kind === 'periodic' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}
                      onClick={d.lawId ? () => go(`/laws?law=${d.lawId}`) : d.href ? () => go(d.href!) : undefined} />
                  })}</div>
                </div>) })}
            </div>)}
      </div>
    </div>
  )
}

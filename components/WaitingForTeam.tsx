'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Duty } from '@/lib/duties'
import { addDays, CHECKLIST_START } from '@/lib/dailyChecksShared'
import DailyChecklistClient, { TileSheet } from '@/app/(protected)/standards/DailyChecklistClient'
import type { CheckTile } from '@/lib/dailyChecksShared'
import ClockApprovals from '@/components/ClockApprovals'
import { fallsOn } from '@/lib/dutyFilter'
import ClockNotices from '@/components/ClockNotices'
import PenaltyDecisions from '@/components/PenaltyDecisions'
import DateStrip from '@/components/DateStrip'
import WorkloadStrip from '@/components/WorkloadStrip'
import TaskTile, { tileGrid, type TileDensity } from '@/components/TaskTile'
import { LAW_TYPES } from '@/lib/lawCategories'
import { ACTIVE_STAFF } from '@/lib/staffList'
import { lawPageHref } from '@/lib/lawAreas'

const BANDS: { key: string; label: string; test: (d: Duty) => boolean }[] = [
  { key: 'opener', label: 'Opener', test: d => d.role === 'Opener' },
  { key: 'daytime', label: 'Daytime', test: d => (d.kind === 'task' || d.kind === 'periodic') && d.role !== 'Opener' && d.role !== 'Closer' },
  { key: 'closer', label: 'Closer', test: d => d.role === 'Closer' },
  { key: 'oneoff', label: 'To do items', test: d => d.kind === 'oneoff' || d.kind === 'job' },
  { key: 'standing', label: 'Standing duties', test: d => d.kind === 'standing' },
]
const nm = (n: string | null) => (n ? n.charAt(0).toUpperCase() + n.slice(1) : '')
// Opens another page in the Shop (the hub's right pane) from inside this frame.
// Inside the Shop's frame the message goes to the hub above; used directly inside the hub (Home page) it goes to the hub itself.
const go = (path: string) => { if (window.parent !== window || (window as unknown as { __gmHub?: boolean }).__gmHub) (window.parent !== window ? window.parent : window).postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }
const todayKey = () => new Date().toISOString().slice(0, 10)

// The Shop's first tab. One strip of small date tiles runs across the top (earlier days to the left, today, then the days ahead); the page below
// holds only what belongs to the chosen date: today's live list, an earlier day's record, or a coming day's planned tasks (named from the rota).
export default function WaitingForTeam({ canManage, below, noPeople }: { canManage: boolean; below?: React.ReactNode; noPeople?: boolean }) {
  const today = todayKey()
  const density: TileDensity = 'full'   // every tile shows its whole text: no Small setting
  // Filter by person: on Today anyone can; on other dates only the people the signed-in supervisor may look at.
  const [who, setWho] = useState('')
  const [viewable, setViewable] = useState<string[]>([])
  const [self, setSelf] = useState('')
  useEffect(() => { fetch('/api/my-day?people=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => { setViewable(Array.isArray(d?.people) ? d.people : []); setSelf(String(d?.self ?? '')) }).catch(() => {}) }, [])
  // Everyone, the owner and Joe too, opens this page on their own name: what they have to do is what they see first. The owner and Joe can pick Everyone or one person from the list.
  const whoTouched = useRef(false)
  useEffect(() => { if (self && !whoTouched.current) setWho(self) }, [self])
  const [cardsOpen, setCardsOpen] = useState<null | 'approve' | 'cards'>(null)   // the clock notices, decisions and approvals open in a sheet, not as cards above the tiles
  const [teamLate, setTeamLate] = useState(0)
  const [refresh, setRefresh] = useState(0)
  // For the owner and Joe: how many tasks anyone has overdue right now, shown beside the list (they start on their own name).
  useEffect(() => {
    if (!canManage) return
    let live = true
    const go = () => fetch('/api/daily-checks', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { if (live && Array.isArray(j?.duties)) setTeamLate((j.duties as Duty[]).filter(d => d.state === 'late' && d.kind === 'task').length) }).catch(() => {})
    void go(); const t = setInterval(go, 120000)
    return () => { live = false; clearInterval(t) }
  }, [canManage, refresh])
  // A tap on a clock/question/approval duty tile: show the person's own cards (chip = Everyone for a manager, else their own name), then scroll to them.
  useEffect(() => {
    const f = (e: Event) => {
      const what = String((e as CustomEvent).detail ?? '')
      whoTouched.current = true; setWho(self); setSel(today); setCardsOpen(what === 'approve' ? 'approve' : 'cards')
    }
    window.addEventListener('wft-focus', f); return () => window.removeEventListener('wft-focus', f)
  }, [canManage, self, today])
  const [sel, setSel] = useState(today)
  const [ahead, setAhead] = useState(31)
  const [fduties, setFduties] = useState<Duty[] | null>(null)
  const [canAdd, setCanAdd] = useState(false)
  const [people, setPeople] = useState<string[]>([])
  const [adding, setAdding] = useState(false)
  const [futureTile, setFutureTile] = useState<CheckTile | null>(null)   // a tile of a coming day: the same pop-up as Today, every control off
  const openFuture = (d: Duty) => { void fetch('/api/daily-checks/tiles', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).then(j => { const t = (j?.tiles as CheckTile[] | undefined)?.find(x => x.id === d.id); if (t) setFutureTile(t); else setPeek(d) }).catch(() => setPeek(d)) }
  const [peek, setPeek] = useState<Duty | null>(null)   // a tapped tile on another day: what it is, when, who, and how it ended (nothing can be recorded on those days)
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
        {canAdd && <button type="button" onClick={() => setAdding(a => !a)} title="Add a to-do for a date" className="shrink-0 rounded-lg bg-[#14213D] px-2 py-1.5 text-[12px] font-bold text-white">{adding ? '✕' : '+ To do'}</button>}
      </div>
      {!noPeople && canManage && chipNames.length > 0 && (
        <div className="mt-0.5 flex items-center gap-2 px-2">
          <select aria-label="Whose tasks" value={person} onChange={e => { whoTouched.current = true; setWho(e.target.value) }}
            className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-[14px] font-bold text-gray-900">
            <option value="">Everyone</option>
            {chipNames.map(n => <option key={n} value={n}>{nm(n)}{n === self ? ' (me)' : ''}</option>)}
          </select>
          {sel === today && person !== '' && teamLate > 0 && <button type="button" onClick={() => { whoTouched.current = true; setWho('') }} className="shrink-0 rounded-full bg-red-50 px-2.5 py-1.5 text-[12px] font-bold text-red-700">Everyone: {teamLate} overdue</button>}
        </div>)}
      {!noPeople && !canManage && chipNames.length > 0 && (
        <div className="mt-0.5 flex flex-nowrap gap-1 overflow-x-auto px-2">
          {['', ...chipNames].map(n => (
            <button key={n || 'all'} type="button" onClick={() => { whoTouched.current = true; setWho(n) }} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-bold ${person === n ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{n ? nm(n) : 'Everyone'}</button>
          ))}
        </div>)}
      </div>
      {below}
      {msg && <p className="mx-2 mt-1 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{msg}</p>}
      {futureTile && <TileSheet t={futureTile} isToday={false} canEdit={canManage} present={[]} notYet={new Date(sel + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })} onClose={() => setFutureTile(null)} onSaved={() => setFutureTile(null)} />}
      {peek && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/40" onClick={() => setPeek(null)}>
          <div role="dialog" aria-label="Task" className="mx-auto w-full max-w-md space-y-2 rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[12px] font-bold uppercase text-gray-500">{new Date(sel + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <button type="button" onClick={() => setPeek(null)} aria-label="Close" className="text-xl text-gray-500">✕</button>
            </div>
            <p className="text-[16px] font-semibold leading-snug text-gray-900">{peek.title}</p>
            <p className="text-[13px] text-gray-700">{peek.kind === 'task' ? `${String(Math.floor((peek.shown ?? peek.due) / 60)).padStart(2, '0')}:${String((peek.shown ?? peek.due) % 60).padStart(2, '0')}` : peek.time}{peek.mins ? ` · ${peek.mins} min` : ''} · {peek.role ? peek.role : 'Anyone on shift'}{peek.owner ? ` · ${nm(peek.owner)}` : ''}</p>
            <p className="text-[12px] text-gray-500">{[peek.category, peek.typeLabel ?? LAW_TYPES.find(x => x.key === peek.lawType)?.label].filter(Boolean).join(' · ')}</p>
            <div className={`rounded-lg px-3 py-2 text-[13px] ${peek.state === 'done' ? 'bg-green-50 text-green-900' : peek.state === 'plan' || peek.state === 'later' ? 'bg-gray-50 text-gray-700' : 'bg-amber-50 text-amber-900'}`}>
              {peek.state === 'plan' ? 'Planned. It can be done on the day.' : peek.state === 'done' ? `Done${peek.by ? ` by ${nm(peek.by)}` : ''}${peek.at ? ` at ${peek.at}` : ''}.` : peek.state === 'no' ? `Marked not done${peek.by ? ` by ${nm(peek.by)}` : ''}. Reason: ${peek.note ?? ''}` : peek.state === 'miss' ? 'Missed: nobody did it that day.' : 'Not done yet.'}
              {peek.state === 'done' && peek.note ? ` ${peek.note}` : ''}
            </div>
            <p className="text-[12px] text-gray-500">Staff record a task on the day itself: tap it on Today. How it is recorded (tick, photo, question) is set in its law.</p>
            {canManage && peek.lawId ? <button type="button" onClick={() => { setPeek(null); go(lawPageHref(peek.lawId, peek.category)!) }} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white">Open the law to change it</button> : null}
            {canManage && !peek.lawId && lawPageHref(null, peek.category) ? <><p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900"><b>No law is set for this task yet.</b> Open its topic to write the law behind it.</p><button type="button" onClick={() => { setPeek(null); go(lawPageHref(null, peek.category)!) }} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white">Open the topic to add the law</button></> : null}
          </div>
        </div>)}
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
      <WorkloadStrip date={sel} />
      {cardsOpen && sel === today && (
        <div className="fixed inset-0 z-[70] flex items-end bg-black/40" onClick={() => setCardsOpen(null)}>
          <div role="dialog" aria-label="To decide or answer" className="mx-auto max-h-[88vh] w-full max-w-md space-y-2 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="text-base font-bold text-gray-900">{cardsOpen === 'approve' ? 'To approve' : 'To answer'}</p><button type="button" onClick={() => setCardsOpen(null)} aria-label="Close" className="text-xl text-gray-500">✕</button></div>
            <ClockNotices onChange={() => setRefresh(n => n + 1)} /><PenaltyDecisions onChange={() => setRefresh(n => n + 1)} />{canManage && <div className="grid grid-cols-1 gap-2"><ClockApprovals density={density} /></div>}
          </div>
        </div>)}
      <div className="mt-2">
        {sel <= today
          ? <DailyChecklistClient key={`${sel}-${refresh}`} canManage={canManage} embedded density={density} person={person} dayParam={sel === today ? null : sel}
              inlineFor={sel === today && (!person || person === self) ? self : null} />
          : (
            <div className="space-y-1 px-2">
              {fduties === null && <p className="text-sm text-gray-400">Loading…</p>}
              {fduties && fduties.filter(mine).length === 0 && <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500">Nothing is planned for {person ? nm(person) : 'this day'}.</p>}
              {fduties && BANDS.map(b => { const rows = fduties.filter(mine).filter(d => b.test(d)); if (!rows.length) return null; return (
                <div key={b.key}>
                  <p className="mb-0.5 text-[12px] font-extrabold uppercase tracking-wide text-gray-500">{b.label}</p>
                  <div className={tileGrid(density)}>{rows.map(d => {
                    const whoL = (d.role && d.role !== 'Joe' ? `${d.role}${d.owner ? ` · ${nm(d.owner)}` : ''}` : d.owner ? nm(d.owner) : d.role ?? 'Everyone')
                    return <TaskTile key={d.key} density={density} time={d.kind === 'task' ? `${String(Math.floor((d.shown ?? d.due) / 60)).padStart(2, '0')}:${String((d.shown ?? d.due) % 60).padStart(2, '0')}${d.mins ? ` · ${d.mins} min` : ''}` : d.time || undefined} title={d.title} who={whoL} category={d.category} type={d.typeLabel ?? LAW_TYPES.find(x => x.key === d.lawType)?.label}
                      badge={d.count} detail={d.detail ?? d.note} tone={d.kind === 'oneoff' || d.kind === 'job' ? 'border-indigo-300 bg-indigo-50' : d.kind === 'periodic' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}
                      onClick={d.kind === 'task' && sel > today ? () => openFuture(d) : d.kind === 'task' || d.kind === 'periodic' ? () => setPeek(d) : d.href ? () => go(d.href!) : undefined} onLaw={lawPageHref(d.lawId, d.category) ? () => go(lawPageHref(d.lawId, d.category)!) : undefined} />
                  })}</div>
                </div>) })}
            </div>)}
      </div>
    </div>
  )
}

'use client'
import { cap } from '@/lib/strings'
import WithMic from '@/components/WithMic'
import ClosingReportCard from '@/components/ClosingReportCard'
import GroupForm from '@/components/GroupForm'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LAW_CATEGORIES, LAW_TYPES } from '@/lib/lawCategories'
import TaskTile, { tileGrid, type TileDensity } from '@/components/TaskTile'
import type { Duty } from '@/lib/duties'
import {
  CHECK_SECTIONS, CHECKLIST_START, FREQUENCIES, NOT_AVAILABLE_REASONS, NOT_WORKING_REASONS, PERIOD_WORD, PROPERTY_LOCATIONS, WEEKDAY_LABEL,
  addDays, appliesOn, dayLabel, effectiveDue, hhmm, inPeriod, shortTitle, type CheckEvent, type CheckTile, type Frequency,
} from '@/lib/dailyChecksShared'

const json = { 'Content-Type': 'application/json' }
const evTime = (e: CheckEvent) => e.extra?.done_at ?? hhmm(e.recorded_at)
const nowHM = () => { const d = new Date(); return d.getUTCHours() * 60 + d.getUTCMinutes() }

// Tiles that are a job done on another page of the app get a button that opens it (the stock count).
const linkFor = (t: CheckTile): { href: string; label: string } | null =>
  /^count now/i.test(t.title) ? { href: '/item?view=counts', label: 'Open Counts' }
  : /^closing questions answered/i.test(t.title) ? { href: '/item?view=closer', label: 'Open Closer' }
  : /^opening questions answered/i.test(t.title) ? { href: '/item?view=opener', label: 'Open Opener' }
  : /^go through the pending jobs/i.test(t.title) ? { href: '/pending-jobs', label: 'Open pending jobs' } : null

type Adhoc = { id: number; category: string; note: string; photo_url: string | null; minutes: number; credited: number; recorded_by: string; recorded_at: string }

type Prop = { id: number; name: string; availability: string | null; working: string | null; location: string | null; not_working_reason: string | null; not_available_reason: string | null }

// Who does a task: the law's "Who does it". The Opener and Closer are named once they are known for the day.
const nm = (n: string) => n.charAt(0).toUpperCase() + n.slice(1)
function WhoTag({ t, roles }: { t: { assignment?: string }; roles: { opener: string | null; closer: string | null } }) {
  const a = t.assignment ?? 'all'
  const [label, cls] = a === 'opener' ? [`Opener${roles.opener ? ` · ${nm(roles.opener)}` : ''}`, 'bg-indigo-100 text-indigo-800']
    : a === 'closer' ? [`Closer${roles.closer ? ` · ${nm(roles.closer)}` : ''}`, 'bg-purple-100 text-purple-800']
    : a === 'managers' ? ['Joe', 'bg-amber-100 text-amber-900'] : ['Everyone', 'bg-gray-100 text-gray-600']
  return <span className={`ml-1 inline-block shrink-0 rounded-full px-1.5 py-px align-middle text-[9px] font-bold ${cls}`}>{label}</span>
}

export default function DailyChecklistClient({ canManage, embedded = false, extras, dayParam = null, density = 'compact', person = '' }: { canManage: boolean; embedded?: boolean; extras?: React.ReactNode; dayParam?: string | null; density?: TileDensity; person?: string }) {
  const canEdit = canManage
  const [tiles, setTiles] = useState<CheckTile[]>([])
  const [events, setEvents] = useState<CheckEvent[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [today, setToday] = useState('')
  const [dayStart, setDayStart] = useState<number | null>(null)
  const [clockedIn, setClockedIn] = useState(true)
  const [present, setPresent] = useState<string[]>([])
  const [roles, setRoles] = useState<{ opener: string | null; closer: string | null }>({ opener: null, closer: null })
  const [adhoc, setAdhoc] = useState<Adhoc[]>([])
  const [duties, setDuties] = useState<Duty[]>([])
  const [logging, setLogging] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<CheckTile | null>(null)
  const [reporting, setReporting] = useState(false)
  const [clock, setClock] = useState(() => nowHM())
  useEffect(() => { const t = setInterval(() => setClock(nowHM()), 30000); return () => clearInterval(t) }, [])
  // Who a task falls on and how it stands come from the server (the same duties calculation Waiting for me reads).
  const whoOfDuty = (d: Duty) => (d.role && d.role !== 'Joe' ? `${d.role}${d.owner ? ` · ${nm(d.owner)}` : ''}` : d.owner ? nm(d.owner) : d.role ?? 'Everyone')
  // A duty with a task behind it opens that task; the rest (standing duties, one-offs, jobs) are information.
  // A duty that is not a checklist tile (laws to sign, CCTV reviews, pending jobs...) opens the place where it is done: in the hub's frame through the hub, otherwise directly.
  const goTo = (path: string) => { if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path }, window.location.origin); else window.location.href = path }
  const tileOf = (d: Duty) => (d.kind === 'task' || d.kind === 'periodic' ? tiles.find(t => t.id === d.id) : undefined)
  const mineOrDid = (d: Duty) => !person || d.owner === person.toLowerCase() || d.by?.toLowerCase() === person.toLowerCase()
  const typeOf = (d: Duty) => d.typeLabel ?? LAW_TYPES.find(x => x.key === d.lawType)?.label
  const [pastFilter, setPastFilter] = useState<'all' | 'done' | 'no' | 'miss'>('all')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const load = useCallback(async (d: string | null) => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(`/api/daily-checks${d ? `?day=${d}` : ''}`, { cache: 'no-store' })
        const j = await r.json()
        if (r.ok && Array.isArray(j.tiles)) { setTiles(j.tiles); setDuties(Array.isArray(j.duties) ? j.duties : []); setEvents(j.events); setToday(j.today); setDay(j.day); setDayStart(typeof j.dayStart === 'number' ? j.dayStart : null); setClockedIn(j.clockedIn !== false); setPresent(Array.isArray(j.present) ? j.present : []); setRoles({ opener: j.opener ?? null, closer: j.closer ?? null }); setAdhoc(Array.isArray(j.adhoc) ? j.adhoc : []); setError(''); return }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 700 * (i + 1)))
    }
    setError('Could not load the checklist. Pull down to try again.')
  }, [])
  useEffect(() => { void load(dayParam) }, [load, dayParam])
  // Waiting for me opens the exact task: /standards?tile=ID
  const deepTile = useRef(false)
  useEffect(() => {
    if (deepTile.current || !tiles.length) return
    const id = Number(new URLSearchParams(window.location.search).get('tile'))
    deepTile.current = true
    if (!id) return
    const t = tiles.find(x => x.id === id); if (t) setSheet(t)
  }, [tiles])
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && day === today) void load(day) }, 90000)
    return () => clearInterval(t)
  }, [load, day, today])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const isToday = !!day && day === today
  const latest = (t: CheckTile) => day ? events.filter(e => e.tile_id === t.id && inPeriod(t.frequency, e.day, day)).at(-1) : undefined
  // On a given day: daily tiles always; weekly/monthly/yearly tiles stay on their tab; a weekday tile only when it is that weekday (or already done).
  const visible = useMemo(() => tiles.filter(t => !day || appliesOn(t, day)), [tiles, day])

  async function tap(t: CheckTile) {
    if (locked) { flash('Clock in first.'); return }
    if (t.kind !== 'tap') { setSheet(t); return }
    try {
      const r = await fetch('/api/daily-checks/tap', { method: 'POST', headers: json, body: JSON.stringify({ tile_id: t.id }) })
      if (!r.ok) throw new Error()
      flash(`Done: ${t.title}`); void load(day)
    } catch { flash('NOT saved. Try again.') }
  }

  // What to do right now. The day starts when the first staff member clocks in; before that nothing is due or late.
  // A task is late 15 minutes after it was due (see effectiveDue for how the morning tasks are queued from clock-in).
  const due = useMemo(() => effectiveDue(tiles, dayStart), [tiles, dayStart])
  // Before the first clock-in each task waits at its own planned time.
  const planned = useMemo(() => { const m = new Map<number, number>(); for (const t of tiles) if (t.frequency === 'daily' && t.kind !== 'properties' && t.time && /^\d\d:\d\d$/.test(t.time)) m.set(t.id, Number(t.time.slice(0, 2)) * 60 + Number(t.time.slice(3))); return m }, [tiles])
  const dueOf = (id: number) => (dayStart == null ? planned.get(id) : due.get(id)) ?? 0
  const pending = isToday ? visible.filter(t => (dayStart == null ? planned.has(t.id) : due.has(t.id)) && (!latest(t) || latest(t)?.extra?.overruled)).sort((a, b) => dueOf(a.id) - dueOf(b.id) || a.id - b.id) : []
  const late = dayStart == null ? [] : pending.filter(t => clock - due.get(t.id)! >= 15)
  const dueNow = dayStart == null ? [] : pending.filter(t => { const d = clock - due.get(t.id)!; return d >= 0 && d < 15 })
  // Everything still ahead today (before the first clock-in the whole day is ahead).
  const next = dayStart == null ? pending : pending.filter(t => due.get(t.id)! > clock)
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const locked = isToday && !clockedIn
  // Shown only once the chosen day has loaded (switching dates must not flash the previous day).
  const settling = (dayParam !== null && day !== dayParam) || (dayParam === null && !!today && day !== today)
  const pastDuties = !isToday ? duties.filter(d => (d.kind !== 'task' || !!tileOf(d)) && mineOrDid(d)) : []
  const [showLate, setShowLate] = useState(false)
  const [todayFilter, setTodayFilter] = useState<'all' | 'waiting' | 'overdue' | 'done'>('all')
  // Every timed task of today in time order, each with how it stands (the server's duties).
  const dayList = isToday ? duties.filter(d => (d.kind !== 'task' || !!tileOf(d)) && mineOrDid(d))
    .map(d => ({ d, st: (d.state === 'done' || d.state === 'no' || d.state === 'late' || d.state === 'now' ? d.state : 'later') as 'done' | 'no' | 'late' | 'now' | 'later' })) : []

  return (
    <div className={embedded ? 'pb-24' : 'mx-auto max-w-3xl px-3 pb-24 pt-3'} onClick={e => {
      // inside the Shop's frame, pages that belong in the Shop open there (not inside this frame)
      const a = (e.target as HTMLElement).closest?.('a') as HTMLAnchorElement | null
      if (!a || window.parent === window) return
      const u = new URL(a.href, window.location.href)
      if (u.origin === window.location.origin && (u.pathname.startsWith('/pending-jobs') || u.pathname.startsWith('/laws'))) { e.preventDefault(); window.parent.postMessage({ type: 'open-path', path: u.pathname + u.search }, window.location.origin) }
    }}>
      {!embedded && (
      <div className="mb-1 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Today</h1>
      </div>)}
      {error && <p className="mx-3 mb-2 text-sm text-red-600">{error}</p>}
      {settling && !error && <p className="px-3 text-sm text-gray-400">Loading…</p>}
      {!settling && !isToday && day && (
        <div className="space-y-1.5 px-2">
          <div className="flex flex-nowrap gap-1 overflow-x-auto">
            {([['all', 'Everything', pastDuties.length], ['done', 'Done', pastDuties.filter(x => x.state === 'done').length], ['no', 'Marked not done', pastDuties.filter(x => x.state === 'no').length], ['miss', 'Not done at all', pastDuties.filter(x => x.state === 'miss').length]] as const).map(([k, label, n]) => (
              <button key={k} type="button" onClick={() => setPastFilter(k)} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${pastFilter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label} {n}</button>
            ))}
          </div>
          <div className={tileGrid(density)}>
            {pastDuties.filter(d => pastFilter === 'all' || d.state === pastFilter).map(d => (
              <TaskTile key={d.key} density={density} time={d.kind === 'task' ? fmt(d.due) : d.time || undefined} title={d.title} who={d.by ? nm(d.by) : whoOfDuty(d)} category={d.category} type={typeOf(d)} badge={d.count}
                detail={d.detail ?? d.note ?? null} mark={d.state === 'done' ? 'done' : d.state === 'miss' ? 'miss' : 'no'} tone={d.state === 'done' ? 'border-green-400 bg-green-50' : d.state === 'no' ? 'border-gray-300 bg-gray-100' : 'border-red-300 bg-red-50'}
                onClick={tileOf(d) ? () => setSheet(tileOf(d)!) : d.href ? () => goTo(d.href!) : undefined} lawHref={canEdit && d.lawId ? `/laws?law=${d.lawId}` : undefined} />))}
          </div>
          {pastDuties.length === 0 && <p className="text-sm text-gray-400">No tasks were recorded for this day.</p>}
          {adhoc.length > 0 && (
            <div className="space-y-1"><p className="text-[10px] font-extrabold uppercase text-gray-500">Other work logged</p>
              {adhoc.map(a => <p key={a.id} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-[11px] text-gray-900"><b>{a.recorded_by}</b> · {hhmm(a.recorded_at)} · {a.note}</p>)}
            </div>)}
        </div>
      )}
          {/* Same structure as Waiting for me: one filter row, one grid of tiles (late red, due now amber, later grey, done green). */}
      {!settling && isToday && <div className="mx-2 mb-1 flex flex-nowrap items-center gap-1 overflow-x-auto">
            {([['all', 'Everything', dayList.length], ['waiting', 'Waiting', dayList.filter(x => x.st === 'now' || x.st === 'later').length], ['overdue', 'Overdue', dayList.filter(x => x.st === 'late').length], ['done', 'Done', dayList.filter(x => x.st === 'done' || x.st === 'no').length]] as const).map(([k, label, n]) => (
              <button key={k} type="button" onClick={() => setTodayFilter(k)} className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold ${todayFilter === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{label} {n}</button>
            ))}
            {canEdit && <button type="button" onClick={() => setReporting(true)} className="ml-auto shrink-0 whitespace-nowrap px-1 text-[11px] font-bold text-blue-700 underline">Day report</button>}
      </div>}
      {!settling && isToday && (
        <div className="mx-2 mb-2 space-y-1.5 rounded-xl border border-[#14213D] bg-white p-1">
          {dayStart == null && <p className="text-xs font-semibold text-gray-600">Nobody has clocked in yet. The day&apos;s tasks start when the first person does; they are listed at their planned times.</p>}
          {locked && <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">You are not clocked in. Clock in first, then you can tick tasks. You can still read them.</p>}
          {dayStart != null && late.length === 0 && dueNow.length === 0 && <p className="text-xs font-semibold text-green-700">Nothing late. {next.length ? 'Later tasks are below.' : 'All timed tasks are done.'}</p>}
          {/* The decisions and day duties that matter most (clock times and CCTV for the owner and Joe, the closing report, pending jobs) come first, above the timed tasks. */}
          {!person && <div className={`${tileGrid(density)} empty:hidden`}><ClosingReportCard density={density} closer={roles.closer} />{extras}</div>}
          {person && dayList.length === 0 && <p className="rounded-lg bg-gray-50 p-3 text-xs font-semibold text-gray-600">Nothing falls on {nm(person)} today yet. Tasks are shared out by the rota once they are at work.</p>}
          <div className={tileGrid(density)}>
            {dayList.filter(x => todayFilter === 'all' || (todayFilter === 'waiting' && (x.st === 'now' || x.st === 'later')) || (todayFilter === 'overdue' && x.st === 'late') || (todayFilter === 'done' && (x.st === 'done' || x.st === 'no'))).map(({ d, st }) => (
              <TaskTile key={d.key} density={density} time={d.kind === 'task' ? fmt(d.due) : d.time || undefined} title={d.title} who={d.by ? nm(d.by) : whoOfDuty(d)} category={d.category} type={typeOf(d)} badge={d.count}
                detail={d.detail ?? d.note ?? null} mark={st === 'done' ? 'done' : st === 'no' ? 'no' : undefined}
                tone={st === 'done' ? 'border-green-400 bg-green-50' : st === 'no' ? 'border-gray-300 bg-gray-100' : st === 'late' ? 'border-red-300 bg-red-50' : st === 'now' ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-gray-50'}
                onClick={tileOf(d) ? () => setSheet(tileOf(d)!) : d.href ? () => goTo(d.href!) : undefined} lawHref={canEdit && d.lawId ? `/laws?law=${d.lawId}` : undefined} />
            ))}
          </div>
        </div>
      )}
      {!settling && isToday && <button type="button" disabled={locked} onClick={() => setLogging(true)} className="mx-2 mb-2 w-[calc(100%-1rem)] rounded-xl bg-green-600 py-2 text-sm font-bold text-white disabled:opacity-40">+ Log an activity not on the list</button>}
      {sheet && (sheet.kind === 'properties'
        ? <PropsSheet t={sheet} ev={latest(sheet)} isToday={isToday && !locked} canEdit={canEdit} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load(day) }} />
        : <TileSheet t={sheet} ev={latest(sheet)} isToday={isToday && !locked} canEdit={canEdit} present={present} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load(day) }} />)}
      {logging && <AdhocForm onClose={() => setLogging(false)} onSaved={m => { flash(m); setLogging(false); void load(day) }} />}
      {reporting && <DayReport day={day ?? today} onClose={() => setReporting(false)} />}
      {toast && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">{toast}</div>}
    </div>
  )
}

function useRun(onSaved: (m: string) => void, onClose: () => void) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function run(fn: () => Promise<Response>, msg: string) {
    setBusy(true); setErr('')
    try {
      const r = await fn(); const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error ?? 'Could not save')
      onSaved(msg); onClose()
    } catch (e) { setErr((e as Error).message) }
    setBusy(false)
  }
  return { busy, err, setErr, run }
}

function TileSheet({ t, ev, isToday, canEdit, present, onClose, onSaved }: { t: CheckTile; ev?: CheckEvent; isToday: boolean; canEdit: boolean; present: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [doneAt, setDoneAt] = useState(ev?.extra?.done_at ?? '')
  const [note, setNote] = useState(ev?.note ?? '')
  const [editing, setEditing] = useState(false)
  const { busy, err, setErr, run } = useRun(onSaved, onClose)
  const record = (value: 'Done' | 'Not done') => run(() => fetch('/api/daily-checks/tap', { method: 'POST', headers: json, body: JSON.stringify({ tile_id: t.id, value, done_at: doneAt || undefined, note: note || undefined }) }), `${value}: ${t.title}`)
  const patch = (extra: Record<string, unknown>, msg: string) => run(() => fetch(`/api/daily-checks/events/${ev!.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ done_at: doneAt || null, note: note || null, ...extra }) }), msg)
  const revert = () => { if (confirm('Remove this record and put the tile back to waiting?')) void run(() => fetch(`/api/daily-checks/events/${ev!.id}`, { method: 'DELETE' }), 'Reverted') }
  const ago = (m: number) => { const d = new Date(Date.now() - m * 60000); setDoneAt(`${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`) }
  // A weekly / monthly task already recorded in an earlier day of the period: only the owner-level removal applies.
  const editableEv = !!ev && isToday

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[88vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="text-5xl leading-none">{t.icon}</span>
          <div>
            <p className="text-base font-bold text-gray-900">{t.title}</p>
            <p className="text-xs text-gray-500">{ev ? `${ev.value === 'Not done' ? 'Not done' : 'Done'} at ${evTime(ev)} on ${ev.day} by ${ev.recorded_by}` : t.time && t.frequency === 'daily' ? `Planned for ${t.time}` : 'Not recorded yet'}</p>
          </div>
        </div>
        {t.how && <p className="rounded-xl bg-gray-50 p-3 text-xs text-gray-600"><b>How:</b> {t.how}</p>}
        {linkFor(t) && <a href={linkFor(t)!.href} className="block w-full rounded-xl bg-blue-600 py-3 text-center text-base font-bold text-white">{linkFor(t)!.label}</a>}
        {t.frequency === 'daily' && t.kind !== 'properties' && t.time && <p className="text-[11px] font-semibold text-red-700">If this is still undone at the end of the day, whoever it falls on gets a penalty point (at most 3 a day). Marking it Not done with a real reason excuses the point.</p>}
        {t.law_id && t.category && <a href={`/laws?cat=${encodeURIComponent(t.category)}`} className="block text-[11px] font-semibold text-blue-700 underline">From the Company Laws · {t.category}{t.subcategory ? ` › ${t.subcategory}` : ''}</a>}
        {t.minutes != null && <p className="text-[11px] font-semibold text-indigo-700">Counts as {t.minutes} minute{t.minutes === 1 ? '' : 's'} of work time for whoever does it.</p>}
        {ev?.note && !editableEv && <p className="text-xs text-gray-600">Note: {ev.note}</p>}
        {t.kind === 'group' && <GroupForm tileId={t.id} day={ev?.day ?? new Date().toISOString().slice(0, 10)} editable={isToday} canEdit={canEdit} onSaved={onSaved} onClose={onClose} />}
        {t.kind !== 'tap' && t.kind !== 'group' && !ev && isToday && <AnswerForm t={t} present={present} onSaved={onSaved} onClose={onClose} />}
        {ev && t.kind !== 'tap' && t.kind !== 'group' && <AnswerSummary ev={ev} />}
        {t.kind === 'tap' && isToday && (!ev || editableEv) && (<>
          <p className="text-xs font-bold uppercase text-gray-500">Time it was done {ev ? '' : '(blank = now)'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {[5, 10, 15, 30, 60].map(m => <button key={m} type="button" onClick={() => ago(m)} className="rounded-full bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-800">{m} min ago</button>)}
            <input type="time" value={doneAt} onChange={e => setDoneAt(e.target.value)} className="rounded-xl border border-gray-300 p-2 text-sm" />
            {doneAt && <button type="button" onClick={() => setDoneAt('')} className="text-xs font-semibold text-gray-500">Clear</button>}
          </div>
          <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (a reason is needed for Not done)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" /></WithMic>
        </>)}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {t.kind === 'tap' && isToday && !ev && (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void record('Done')} className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Done now</button>
            <button type="button" disabled={busy} onClick={() => { if (note.trim().length < 4) { setErr('Write why it could not be done, then press Not done.'); return } void record('Not done') }} className="flex-1 rounded-xl bg-gray-600 py-3 text-base font-bold text-white disabled:opacity-40">Not done</button>
          </div>
        )}
        {canEdit && ev?.value === 'Not done' && !ev.extra?.overruled && isToday && <button type="button" disabled={busy} onClick={() => void patch({ overrule: true }, 'Reason rejected: it will cost a point if still undone')} className="w-full rounded-xl bg-red-600 py-3 text-base font-bold text-white disabled:opacity-40">Reject this reason (counts as missed)</button>}
        {t.kind !== 'tap' && editableEv && <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (back to waiting)</button>}
        {t.kind === 'tap' && editableEv && (<>
          <button type="button" disabled={busy} onClick={() => void patch({}, 'Saved')} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save changes</button>
          <button type="button" disabled={busy} onClick={() => void patch({ value: ev!.value === 'Not done' ? 'Done' : 'Not done' }, 'Changed')} className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white disabled:opacity-40">Change to {ev!.value === 'Not done' ? 'Done' : 'Not done'}</button>
          <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (back to waiting)</button>
        </>)}
        {canEdit && t.law_id && <a href={`/laws?law=${t.law_id}`} className="block py-1 text-sm font-semibold text-blue-700">Edit this task in its law</a>}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

// A tile that opens a list (e.g. Mark printers): same Available / Not available, Working / Not working and Location choices as Properties in Expenses.
function PropsSheet({ t, ev, isToday, canEdit, onClose, onSaved }: { t: CheckTile; ev?: CheckEvent; isToday: boolean; canEdit: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [props, setProps] = useState<Prop[] | null>(null)
  const [editing, setEditing] = useState(false)
  const { busy, err, setErr, run } = useRun(onSaved, onClose)
  useEffect(() => {
    fetch('/api/properties').then(r => r.json()).then((d: unknown) => setProps(Array.isArray(d) ? d as Prop[] : [])).catch(() => setProps([]))
  }, [])
  const words = (t.prop_filter ?? '').split(',').map(w => w.trim().toLowerCase()).filter(Boolean)
  const list = useMemo(() => (props ?? []).filter(p => !words.length || words.some(w => p.name.toLowerCase().includes(w))), [props, t.prop_filter]) // eslint-disable-line react-hooks/exhaustive-deps

  async function patch(p: Prop, u: Partial<Prop>) {
    const m = { ...p, ...u }
    setProps(prev => (prev ?? []).map(x => x.id === p.id ? m : x))
    await fetch(`/api/properties/${p.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({
      availability: m.availability, working: m.working, location: m.location, notWorkingReason: m.not_working_reason, notAvailableReason: m.not_available_reason }) }).catch(() => {})
  }
  const unset = list.filter(p => !p.availability).length
  const summary = () => {
    const av = list.filter(p => p.availability === 'available'), nw = av.filter(p => p.working === 'not_working').length, na = list.filter(p => p.availability === 'not_available').length
    return `${list.length} checked: ${av.length - nw} working, ${nw} faulty, ${na} not available`
  }
  const sel = 'rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs'
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="text-5xl leading-none">{t.icon}</span>
          <div>
            <p className="text-base font-bold text-gray-900">{t.title}</p>
            <p className="text-xs text-gray-500">{ev ? `Done at ${evTime(ev)} by ${ev.recorded_by}${ev.note ? ` · ${ev.note}` : ''}` : 'Set each one, then press Finished.'}</p>
          </div>
        </div>
        {props === null && <p className="text-sm text-gray-400">Loading…</p>}
        {props && list.length === 0 && <p className="text-sm text-gray-500">Nothing in Properties matches &ldquo;{t.prop_filter}&rdquo; yet. Add it as a Property from Expenses, or change the words with Edit this tile.</p>}
        {list.map(p => (
          <div key={p.id} className="space-y-1.5 rounded-xl border border-gray-200 p-3">
            <p className="text-sm font-bold text-gray-900">{p.name}</p>
            <div className="flex flex-wrap gap-2">
              {([['available', 'Available'], ['not_available', 'Not available']] as const).map(([k, l]) => (
                <button key={k} type="button" disabled={!isToday} onClick={() => void patch(p, { availability: k, working: null, location: null, not_working_reason: null, not_available_reason: null })}
                  className={`rounded-full px-3 py-1.5 text-xs font-bold ${p.availability === k ? (k === 'available' ? 'bg-green-600 text-white' : 'bg-red-600 text-white') : 'bg-gray-100 text-gray-700'}`}>{l}</button>
              ))}
            </div>
            {p.availability === 'available' && (<>
              <div className="flex flex-wrap gap-2">
                {([['working', 'Working'], ['not_working', 'Not working']] as const).map(([k, l]) => (
                  <button key={k} type="button" disabled={!isToday} onClick={() => void patch(p, { working: k, not_working_reason: k === 'working' ? null : p.not_working_reason })}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ${p.working === k ? (k === 'working' ? 'bg-green-600 text-white' : 'bg-orange-500 text-white') : 'bg-gray-100 text-gray-700'}`}>{l}</button>
                ))}
              </div>
              {p.working === 'not_working' && (
                <select value={p.not_working_reason ?? ''} disabled={!isToday} onChange={e => void patch(p, { not_working_reason: e.target.value })} className={sel}>
                  <option value="" disabled>Reason…</option>{NOT_WORKING_REASONS.map(r => <option key={r}>{r}</option>)}
                </select>
              )}
              <select value={p.location ?? ''} disabled={!isToday} onChange={e => void patch(p, { location: e.target.value })} className={sel}>
                <option value="" disabled>Where is it?</option>{PROPERTY_LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </>)}
            {p.availability === 'not_available' && (
              <select value={p.not_available_reason ?? ''} disabled={!isToday} onChange={e => void patch(p, { not_available_reason: e.target.value })} className={sel}>
                <option value="" disabled>Reason…</option>{NOT_AVAILABLE_REASONS.map(r => <option key={r}>{r}</option>)}
              </select>
            )}
          </div>
        ))}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {isToday && list.length > 0 && !ev && (
          <button type="button" disabled={busy || unset > 0} onClick={() => void run(() => fetch('/api/daily-checks/tap', { method: 'POST', headers: json, body: JSON.stringify({ tile_id: t.id, note: summary() }) }), `Done: ${t.title}`)}
            className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{unset > 0 ? `${unset} still to set` : 'Finished'}</button>
        )}
        {ev && isToday && <button type="button" disabled={busy} onClick={() => { if (confirm('Remove this record and put the tile back to waiting?')) void run(() => fetch(`/api/daily-checks/events/${ev.id}`, { method: 'DELETE' }), 'Reverted') }} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (back to waiting)</button>}
        {canEdit && t.law_id && <a href={`/laws?law=${t.law_id}`} className="block py-1 text-sm font-semibold text-blue-700">Edit this task in its law</a>}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

type Report = { day: string; total: number; done: number; adhoc: { id: number; category: string; note: string; minutes: number; credited: number; recorded_by: string }[]; people: { person: string; done: number; minutes: number }[]; missed: { id: number; section: string; time: string | null; icon: string; title: string }[] }
function DayReport({ day, onClose }: { day: string; onClose: () => void }) {
  const [r, setR] = useState<Report | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    fetch(`/api/daily-checks/report?day=${day}`).then(async x => { const d = await x.json(); if (!x.ok) throw new Error(d.error ?? 'Could not load'); setR(d) }).catch(e => setErr((e as Error).message))
  }, [day])
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">Day report · {dayLabel(day)}</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        {!r && !err && <p className="text-sm text-gray-400">Loading…</p>}
        {r && (<>
          <p className="rounded-xl bg-gray-50 p-3 text-sm font-semibold">{r.done} of {r.total} daily tasks done{r.total - r.done ? `, ${r.total - r.done} missed` : ''}.</p>
          <div>
            <p className="mb-1 text-xs font-bold uppercase text-gray-500">Who did what</p>
            {r.people.length === 0 && <p className="text-sm text-gray-400">Nothing ticked yet.</p>}
            {r.people.map(p => (
              <div key={p.person} className="flex items-center gap-2 border-b border-gray-100 py-1.5 text-sm">
                <span className="font-semibold text-gray-900">{p.person}</span>
                <span className="ml-auto text-gray-600">{p.done} tasks</span>
                <span className="w-24 text-right font-semibold text-indigo-700">{Math.floor(p.minutes / 60)}hr {p.minutes % 60}min</span>
              </div>
            ))}
          </div>
          {r.adhoc.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-indigo-700">Ad hoc work ({r.adhoc.length})</p>
              <div className="space-y-1">
                {r.adhoc.map(a => (
                  <div key={a.id} className="rounded-lg bg-indigo-50 px-2 py-1 text-xs">
                    <p><b>{a.recorded_by}</b> · {a.category} · asked {a.minutes} min, credited {a.credited} min</p>
                    <p className="text-gray-800">{a.note}</p>
                    <button type="button" className="mt-0.5 font-bold text-red-700 underline" onClick={async () => { if (!confirm('Remove this entry and its work time?')) return; await fetch(`/api/daily-checks/adhoc/${a.id}`, { method: 'DELETE' }); setR(prev => prev && { ...prev, adhoc: prev.adhoc.filter(x => x.id !== a.id) }) }}>Remove</button>
                    <button type="button" className="ml-3 mt-0.5 font-bold text-blue-700 underline" onClick={async () => { const v = prompt('Credit how many minutes?', String(a.credited)); if (v == null) return; const n = Number(v); const res = await fetch(`/api/daily-checks/adhoc/${a.id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ credited: n }) }); if (res.ok) setR(prev => prev && { ...prev, adhoc: prev.adhoc.map(x => x.id === a.id ? { ...x, credited: n } : x) }) }}>Change minutes</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.missed.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-bold uppercase text-red-600">Missed ({r.missed.length})</p>
              <div className="max-h-72 space-y-1 overflow-y-auto">
                {r.missed.map(m => (
                  <div key={m.id} className="flex items-center gap-2 rounded-lg bg-red-50 px-2 py-1 text-xs">
                    <span className="text-base">{m.icon}</span><span className="shrink-0 font-bold text-gray-500">{m.time ?? ''}</span><span className="font-semibold text-gray-900">{m.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>)}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

const shrinkPhoto = async (file: File): Promise<File> => {
  try {
    const bmp = await createImageBitmap(file)
    const sc = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * sc); c.height = Math.round(bmp.height * sc)
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
    const blob: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82))
    return blob ? new File([blob], 'photo.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}

// What a question / person / entry tile recorded, shown once it is done.
function AnswerSummary({ ev }: { ev: CheckEvent }) {
  const x = ev.extra ?? {}
  return (
    <div className="space-y-1 rounded-xl bg-gray-50 p-3 text-xs text-gray-800">
      {x.answer === 'ok' && <p className="font-semibold text-green-700">All good, nothing to report.</p>}
      {x.answer === 'issue' && <p className="font-semibold text-orange-700">Reported{x.about_staff ? ` about ${cap(x.about_staff)}` : ''}.</p>}
      {x.persons && Object.entries(x.persons).map(([n, v]) => <p key={n}>{v === 'ok' ? '✓' : '✗'} {cap(n)}</p>)}
      {ev.note && <p>{ev.note}</p>}
      {x.photo_url && <img src={x.photo_url} alt="" className="h-24 w-24 rounded-lg border border-gray-200 object-cover" />}
    </div>
  )
}

// Question, per-person and note/photo tiles: answered in the pop-up; the answer is saved in the checklist history and
// in the matching Grony Manage log.
function AnswerForm({ t, present, onSaved, onClose }: { t: CheckTile; present: string[]; onSaved: (m: string) => void; onClose: () => void }) {
  const [answer, setAnswer] = useState<'ok' | 'issue' | null>(null)
  const [note, setNote] = useState('')
  const [about, setAbout] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [up, setUp] = useState(false)
  const [persons, setPersons] = useState<Record<string, 'ok' | 'not'>>({})
  const [localErr, setLocalErr] = useState('')
  const { busy, err, setErr, run } = useRun(onSaved, onClose)
  const behaviour = t.log_category === 'team_behaviour_log'
  async function pickPhoto(f: File) {
    setUp(true); setLocalErr('')
    try {
      const fd = new FormData(); fd.append('file', await shrinkPhoto(f))
      const r = await fetch('/api/announcements/upload', { method: 'POST', body: fd }); const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Upload failed'); setPhoto(d.url)
    } catch (e) { setLocalErr((e as Error).message) }
    setUp(false)
  }
  const send = (body: Record<string, unknown>) => run(() => fetch('/api/daily-checks/tap', { method: 'POST', headers: json, body: JSON.stringify({ tile_id: t.id, ...body }) }), `Saved: ${t.title.split(':')[0]}`)
  const photoBtn = (
    <div className="flex items-center gap-2">
      <label className="cursor-pointer rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">{up ? 'Uploading…' : photo ? 'Change photo' : `📷 Photo${t.needs_photo ? ' (needed)' : ''}`}
        <input type="file" accept="image/*" capture="environment" className="hidden" disabled={up} onChange={e => { const f = e.target.files?.[0]; if (f) void pickPhoto(f); e.target.value = '' }} /></label>
      {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg border border-gray-200 object-cover" />}
    </div>
  )
  const shownErr = localErr || err

  return (
    <div className="space-y-3">
      {t.ask && <p className="text-sm font-bold text-gray-900">{t.ask}</p>}

      {t.kind === 'question' && (<>
        <div className="flex gap-2">
          <button type="button" disabled={busy} onClick={() => { setAnswer('ok'); void send({ answer: 'ok' }) }} className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{t.ok_label || 'All good'}</button>
          <button type="button" disabled={busy} onClick={() => setAnswer('issue')} className={`flex-1 rounded-xl py-3 text-base font-bold text-white disabled:opacity-40 ${answer === 'issue' ? 'bg-red-700' : 'bg-red-500'}`}>{t.issue_label || 'Report a problem'}</button>
        </div>
        {answer === 'issue' && (<>
          {behaviour && (<>
            <input list="cl-present" value={about} onChange={e => setAbout(e.target.value)} placeholder="Which staff member?" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
            <datalist id="cl-present">{present.map(n => <option key={n} value={cap(n)} />)}</datalist>
          </>)}
          <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="What happened?" className="w-full rounded-xl border border-gray-300 p-3 text-sm" /></WithMic>
          {photoBtn}
          <button type="button" disabled={busy || up || !note.trim() || (behaviour && !about.trim())} onClick={() => void send({ answer: 'issue', note, about_staff: about, photo_url: photo })} className="w-full rounded-xl bg-red-600 py-3 text-base font-bold text-white disabled:opacity-40">Save report</button>
        </>)}
      </>)}

      {t.kind === 'persons' && (<>
        {present.length === 0 && <p className="text-sm text-gray-500">Nobody is clocked in yet.</p>}
        {present.map(n => (
          <div key={n} className="flex items-center gap-2 rounded-xl border border-gray-200 p-2">
            <span className="flex-1 text-sm font-bold text-gray-900">{cap(n)}</span>
            <button type="button" onClick={() => setPersons(p => ({ ...p, [n]: 'ok' }))} className={`rounded-lg px-3 py-2 text-xs font-bold ${persons[n] === 'ok' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700'}`}>✓ Yes</button>
            <button type="button" onClick={() => setPersons(p => ({ ...p, [n]: 'not' }))} className={`rounded-lg px-3 py-2 text-xs font-bold ${persons[n] === 'not' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>✗ No</button>
          </div>
        ))}
        <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" /></WithMic>
        <button type="button" disabled={busy || present.length === 0 || present.some(n => !persons[n])} onClick={() => void send({ persons, note })} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{present.some(n => !persons[n]) ? `${present.filter(n => !persons[n]).length} still to mark` : 'Save'}</button>
      </>)}

      {t.kind === 'entry' && (<>
        <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="Write what you saw or did" className="w-full rounded-xl border border-gray-300 p-3 text-sm" /></WithMic>
        {photoBtn}
        <button type="button" disabled={busy || up || (!note.trim() && !photo) || (t.needs_photo && !photo)} onClick={() => void send({ note, photo_url: photo })} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save</button>
      </>)}
      {shownErr && <p className="text-sm text-red-600">{shownErr}</p>}
    </div>
  )
}

// Work that is not on the list for the day: pick the category, say what was done, add a photo if you like.
function AdhocForm({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [mins, setMins] = useState('10')
  const [photo, setPhoto] = useState<string | null>(null)
  const [up, setUp] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const { busy, err, setErr, run } = useRun(onSaved, onClose)
  async function pick(f: File) {
    setUp(true); setLocalErr('')
    try {
      const fd = new FormData(); fd.append('file', await shrinkPhoto(f))
      const r = await fetch('/api/announcements/upload', { method: 'POST', body: fd }); const d = await r.json()
      if (!r.ok) throw new Error(d.error ?? 'Upload failed'); setPhoto(d.url)
    } catch (e) { setLocalErr((e as Error).message) }
    setUp(false)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">Log an activity</p>
        <p className="text-[11px] text-gray-500">For work you did that is not a tile today. It is saved in the history under its category, and its minutes are added to your work time (up to 60 minutes a day).</p>
        <div className="flex flex-wrap gap-1.5">
          {LAW_CATEGORIES.map(c => <button key={c.key} type="button" onClick={() => setCategory(c.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${category === c.key ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{c.icon} {c.key}</button>)}
        </div>
        <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} placeholder="What did you do?" className="w-full rounded-xl border border-gray-300 p-3 text-sm" /></WithMic>
        <label className="flex items-center gap-2 text-sm font-semibold">About how many minutes
          <input type="number" min={1} max={60} value={mins} onChange={e => setMins(e.target.value)} className="w-20 rounded-xl border border-gray-300 p-2 text-sm" /></label>
        <div className="flex items-center gap-2">
          <label className="cursor-pointer rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">{up ? 'Uploading…' : photo ? 'Change photo' : '📷 Photo (optional)'}
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={up} onChange={e => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = '' }} /></label>
          {photo && <img src={photo} alt="" className="h-12 w-12 rounded-lg border border-gray-200 object-cover" />}
        </div>
        {(localErr || err) && <p className="text-sm text-red-600">{localErr || err}</p>}
        <button type="button" disabled={busy || up || !category || note.trim().length < 4}
          onClick={() => void run(() => fetch('/api/daily-checks/adhoc', { method: 'POST', headers: json, body: JSON.stringify({ category, note, minutes: Number(mins), photo_url: photo }) }), 'Activity logged')}
          className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save activity'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}

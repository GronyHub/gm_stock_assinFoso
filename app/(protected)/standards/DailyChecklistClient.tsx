'use client'
import { cap } from '@/lib/strings'
import WithMic from '@/components/WithMic'
import ClosingReportCard from '@/components/ClosingReportCard'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { LAW_CATEGORIES } from '@/lib/lawCategories'
import {
  CHECK_SECTIONS, CHECKLIST_START, FREQUENCIES, NOT_AVAILABLE_REASONS, NOT_WORKING_REASONS, PERIOD_WORD, PROPERTY_LOCATIONS, WEEKDAY_LABEL,
  addDays, appliesOn, dayLabel, effectiveDue, inPeriod, type CheckEvent, type CheckTile, type Frequency,
} from '@/lib/dailyChecksShared'

const json = { 'Content-Type': 'application/json' }
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const evTime = (e: CheckEvent) => e.extra?.done_at ?? hhmm(e.recorded_at)
const nowHM = () => { const d = new Date(); return d.getUTCHours() * 60 + d.getUTCMinutes() }

// Tiles that are a job done on another page of the app get a button that opens it (the stock count).
const linkFor = (t: CheckTile): { href: string; label: string } | null =>
  /^count now/i.test(t.title) ? { href: '/item?view=counts', label: 'Open Counts' }
  : /^closing questions answered/i.test(t.title) ? { href: '/item?view=closer', label: 'Open Closer' }
  : /^opening questions answered/i.test(t.title) ? { href: '/item?view=opener', label: 'Open Opener' } : null

type Adhoc = { id: number; category: string; note: string; photo_url: string | null; minutes: number; credited: number; recorded_by: string; recorded_at: string }

type Prop = { id: number; name: string; availability: string | null; working: string | null; location: string | null; not_working_reason: string | null; not_available_reason: string | null }

export default function DailyChecklistClient({ canManage }: { canManage: boolean }) {
  const canEdit = canManage
  const [tiles, setTiles] = useState<CheckTile[]>([])
  const [events, setEvents] = useState<CheckEvent[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [today, setToday] = useState('')
  const [dayStart, setDayStart] = useState<number | null>(null)
  const [clockedIn, setClockedIn] = useState(true)
  const [names, setNames] = useState(false)
  const [present, setPresent] = useState<string[]>([])
  const [adhoc, setAdhoc] = useState<Adhoc[]>([])
  const [logging, setLogging] = useState(false)
  const [section, setSection] = useState<string>('All day')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<CheckTile | null>(null)
  const [reporting, setReporting] = useState(false)
  const [clock, setClock] = useState(() => nowHM())
  useEffect(() => { const t = setInterval(() => setClock(nowHM()), 30000); return () => clearInterval(t) }, [])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const held = useRef(false)

  const load = useCallback(async (d: string | null) => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(`/api/daily-checks${d ? `?day=${d}` : ''}`, { cache: 'no-store' })
        const j = await r.json()
        if (r.ok && Array.isArray(j.tiles)) { setTiles(j.tiles); setEvents(j.events); setToday(j.today); setDay(j.day); setDayStart(typeof j.dayStart === 'number' ? j.dayStart : null); setClockedIn(j.clockedIn !== false); setPresent(Array.isArray(j.present) ? j.present : []); setAdhoc(Array.isArray(j.adhoc) ? j.adhoc : []); setError(''); return }
      } catch { /* retry */ }
      await new Promise(r => setTimeout(r, 700 * (i + 1)))
    }
    setError('Could not load the checklist. Pull down to try again.')
  }, [])
  useEffect(() => { void load(null) }, [load])
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === 'visible' && day === today) void load(day) }, 90000)
    return () => clearInterval(t)
  }, [load, day, today])

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500) }
  const isToday = !!day && day === today
  const latest = (t: CheckTile) => day ? events.filter(e => e.tile_id === t.id && inPeriod(t.frequency, e.day, day)).at(-1) : undefined
  // On a given day: daily tiles always; weekly/monthly/yearly tiles stay on their tab; a weekday tile only when it is that weekday (or already done).
  const visible = useMemo(() => tiles.filter(t => !day || appliesOn(t, day)), [tiles, day])
  const inSection = (s: string) => s === 'All day' ? visible.filter(t => t.frequency === 'daily' && t.time) : visible.filter(t => t.section === s)
  const doneCount = (s: string) => inSection(s).filter(t => latest(t)?.value === 'Done').length

  async function tap(t: CheckTile) {
    if (locked) { flash('Clock in first.'); return }
    if (t.kind !== 'tap') { setSheet(t); return }
    try {
      const r = await fetch('/api/daily-checks/tap', { method: 'POST', headers: json, body: JSON.stringify({ tile_id: t.id }) })
      if (!r.ok) throw new Error()
      flash(`Done: ${t.title}`); void load(day)
    } catch { flash('NOT saved. Try again.') }
  }

  const shown = section === 'All day' ? [...inSection('All day')].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.id - b.id) : inSection(section)
  const extraGroups = Array.from(new Set(visible.map(t => t.section))).filter(g => !CHECK_SECTIONS.includes(g)).sort()
  const sections = ['All day', ...[...CHECK_SECTIONS, ...extraGroups].filter(s => inSection(s).length)]
  // What to do right now. The day starts when the first staff member clocks in; before that nothing is due or late.
  // A task is late 15 minutes after it was due (see effectiveDue for how the morning tasks are queued from clock-in).
  const due = useMemo(() => effectiveDue(tiles, dayStart), [tiles, dayStart])
  const pending = isToday && dayStart != null ? visible.filter(t => due.has(t.id) && !latest(t)).sort((a, b) => due.get(a.id)! - due.get(b.id)! || a.id - b.id) : []
  const late = pending.filter(t => clock - due.get(t.id)! >= 15)
  const dueNow = pending.filter(t => { const d = clock - due.get(t.id)!; return d >= 0 && d < 15 })
  const next = pending.filter(t => due.get(t.id)! > clock).slice(0, 3)
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  const locked = isToday && !clockedIn
  const [showLate, setShowLate] = useState(false)
  const total = tiles.length, done = tiles.filter(t => latest(t)?.value === 'Done').length

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <ClosingReportCard />
      <div className="mb-1 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Daily Checklist</h1>
        <a href="/standards/plan" className="text-xs font-semibold text-blue-700 underline">Plan to 31 Dec</a>
        {canManage && <a href="/penalties" className="text-xs font-semibold text-red-700 underline">Penalties</a>}{canManage && <a href="/cctv-review" className="ml-2 text-xs font-semibold text-red-700 underline">CCTV review</a>}
        {canManage && <a href="/standards/history" className="text-xs font-semibold text-blue-700 underline">History</a>}
        {canManage && <a href="/standards/manage" className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">Manage tiles</a>}
      </div>
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-[#14213D] px-3 py-2 text-white">
        <button type="button" disabled={!day || day <= CHECKLIST_START} onClick={() => day && void load(addDays(day, -1))} className="rounded-lg bg-white/15 px-3 py-1 text-lg font-bold disabled:opacity-30">‹</button>
        <div className="flex-1 text-center">
          <p className="text-sm font-bold">{day ? dayLabel(day) : 'Loading…'}</p>
          <p className="text-[11px] text-blue-200">{isToday ? 'Today' : 'Earlier day (view only)'} · {done}/{total} done</p>
        </div>
        <button type="button" disabled={!day || day >= today} onClick={() => day && void load(addDays(day, 1))} className="rounded-lg bg-white/15 px-3 py-1 text-lg font-bold disabled:opacity-30">›</button>
      </div>
      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {isToday && (
        <div className="mb-3 space-y-2 rounded-xl border-2 border-[#14213D] bg-white p-2">
          <div className="flex items-center gap-2">
            <p className="text-sm font-extrabold text-[#14213D]">NOW · {String(Math.floor(clock / 60)).padStart(2, '0')}:{String(clock % 60).padStart(2, '0')}</p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">{late.length} late</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">{dueNow.length} due now</span>
            {canEdit && <button type="button" onClick={() => setReporting(true)} className="ml-auto text-[11px] font-bold text-blue-700 underline">Day report</button>}
          </div>
          {dayStart == null && <p className="text-xs font-semibold text-gray-600">Waiting for the first staff member to clock in. The day&apos;s tasks start when they do.</p>}
          {locked && <p className="rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">You are not clocked in. Clock in first, then you can tick tasks. You can still read them.</p>}
          {dayStart != null && late.length === 0 && dueNow.length === 0 && <p className="text-xs font-semibold text-green-700">Nothing late. {next.length ? 'Next up below.' : 'All timed tasks are done.'}</p>}
          {[{ label: 'LATE', rows: showLate ? late : late.slice(0, 4), cls: 'bg-red-50 border-red-300', more: late.length - 4 }, { label: 'DO NOW', rows: dueNow, cls: 'bg-amber-50 border-amber-300', more: 0 }, { label: 'NEXT', rows: next, cls: 'bg-gray-50 border-gray-200', more: 0 }].map(g => g.rows.length > 0 && (
            <div key={g.label} className="space-y-1">
              <p className={`text-[10px] font-extrabold ${g.label === 'LATE' ? 'text-red-600' : g.label === 'DO NOW' ? 'text-amber-700' : 'text-gray-500'}`}>{g.label}</p>
              {g.rows.map(t => (
                <div key={t.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${g.cls}`}>
                  <button type="button" onClick={() => setSheet(t)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="text-lg leading-none">{t.icon}</span>
                    <span className="shrink-0 text-[10px] font-bold text-gray-500">{fmt(due.get(t.id)!)}</span>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-900">{t.title}</span>
                  </button>
                  {g.label !== 'NEXT' && linkFor(t) && <a href={linkFor(t)!.href} className="shrink-0 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-bold text-white">{linkFor(t)!.label}</a>}
                  {g.label !== 'NEXT' && (t.kind === 'tap'
                    ? <button type="button" disabled={locked} onClick={() => void tap(t)} className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-30">Done</button>
                    : <button type="button" disabled={locked} onClick={() => setSheet(t)} className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-30">Open</button>)}
                </div>
              ))}
              {g.label === 'LATE' && g.more > 0 && <button type="button" onClick={() => setShowLate(v => !v)} className="text-[11px] font-bold text-red-700 underline">{showLate ? 'Show fewer' : `Show ${g.more} more late`}</button>}
            </div>
          ))}
        </div>
      )}
      <div className="sticky top-0 z-10 mb-3 flex flex-wrap gap-1.5 bg-white/95 py-2">
        {sections.map(s => (
          <button key={s} type="button" onClick={() => setSection(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${section === s ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>
            {s}{inSection(s).length ? ` ${doneCount(s)}/${inSection(s).length}` : ''}
          </button>
        ))}
      </div>
      {isToday && <button type="button" disabled={locked} onClick={() => setLogging(true)} className="mb-2 w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">+ Log an activity not on the list</button>}
      <div className="mb-2 flex gap-1.5">
        {([[false, 'Pictures'], [true, 'Names']] as const).map(([v, l]) => (
          <button key={l} type="button" onClick={() => setNames(v)} className={`rounded-full px-3 py-1 text-xs font-bold ${names === v ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{l}</button>
        ))}
      </div>
      <p className="mb-2 text-[11px] text-gray-500">{isToday ? 'Tiles are small so the whole day fits. Tap one to read what it means first, then mark it done there. Switch to Names to read every task as a list. Red = late, amber = due now. Use the Done buttons in the NOW box to tick quickly. Each task you finish adds its minutes to your work time.' : 'This is a past day. You can look but not change it.'}</p>
      {shown.length === 0 && <p className="text-sm text-gray-400">Nothing here yet.{canManage ? ' Use Manage tiles to add some.' : ''}</p>}
      {names ? (
        <div className="space-y-1">
          {shown.map(t => {
            const ev = latest(t)
            const state = ev ? (ev.value === 'Not done' ? 'notdone' : 'done') : 'todo'
            const minsLate = !ev && isToday && due.has(t.id) ? clock - due.get(t.id)! : -1
            return (
              <button key={t.id} type="button" onClick={() => setSheet(t)}
                className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1 text-left ${state === 'done' ? 'border-green-400 bg-green-50' : state === 'notdone' ? 'border-gray-300 bg-gray-100' : minsLate >= 15 ? 'border-red-400 bg-red-50' : minsLate >= 0 ? 'border-amber-400 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                <span className="text-lg leading-none">{t.icon}</span>
                <span className="w-10 shrink-0 text-[10px] font-bold text-gray-500">{t.frequency !== 'daily' ? PERIOD_WORD[t.frequency] : (t.time ?? '')}</span>
                <span className="line-clamp-2 flex-1 text-[11px] font-semibold leading-tight text-gray-900">{t.title}</span>
                {state === 'done' && <span className="text-xs font-bold text-green-700">✓</span>}
                {state === 'notdone' && <span className="text-xs font-bold text-gray-600">✕</span>}
              </button>
            )
          })}
        </div>
      ) : (
      <div className="grid grid-cols-10 gap-1 sm:grid-cols-12">
        {shown.map(t => {
          const ev = latest(t)
          const state = ev ? (ev.value === 'Not done' ? 'notdone' : 'done') : 'todo'
          const flagged = !!ev && (ev.extra?.answer === 'issue' || Object.values(ev.extra?.persons ?? {}).includes('not'))
          const minsLate = !ev && isToday && due.has(t.id) ? clock - due.get(t.id)! : -1
          const isLate = minsLate >= 15
          const isDue = minsLate >= 0 && minsLate < 15
          return (
            <button key={t.id} type="button" title={`${t.time ? t.time + ' · ' : ''}${t.title}`} onContextMenu={e => e.preventDefault()}
              onClick={() => setSheet(t)}
              className={`relative flex aspect-square select-none flex-col items-center justify-center rounded-md border px-0 text-center active:opacity-70 ${flagged ? 'border-orange-500 bg-orange-100' : state === 'done' ? 'border-green-500 bg-green-100' : state === 'notdone' ? 'border-gray-400 bg-gray-200' : isLate ? 'border-red-500 bg-red-100' : isDue ? 'border-amber-500 bg-amber-100' : 'border-gray-200 bg-white'}`}>
              <span className="text-base leading-none sm:text-xl">{t.icon}</span>
              <span className={`mt-px text-[7px] font-bold leading-none sm:text-[9px] ${isLate ? 'text-red-700' : 'text-gray-500'}`}>{t.frequency !== 'daily' ? (t.weekday ? WEEKDAY_LABEL[t.weekday].slice(0, 3) : t.frequency.slice(0, 4)) : (t.time ?? '')}</span>
              {state === 'done' && <span className={`absolute right-0 top-0 text-[8px] font-bold leading-none ${flagged ? 'text-orange-700' : 'text-green-700'}`}>{flagged ? '!' : '✓'}</span>}
              {state === 'notdone' && <span className="absolute right-0 top-0 text-[8px] font-bold leading-none text-gray-600">✕</span>}
            </button>
          )
        })}
      </div>
      )}
      {sheet && (sheet.kind === 'properties'
        ? <PropsSheet t={sheet} ev={latest(sheet)} isToday={isToday && !locked} canEdit={canEdit} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load(day) }} />
        : <TileSheet t={sheet} ev={latest(sheet)} isToday={isToday && !locked} canEdit={canEdit} present={present} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load(day) }} />)}
      {adhoc.length > 0 && (
        <div className="mt-4 space-y-1">
          <p className="text-xs font-extrabold uppercase text-[#14213D]">Ad hoc work · {adhoc.length}</p>
          {adhoc.map(a => (
            <div key={a.id} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5">
              <p className="text-[11px] font-bold text-indigo-900">{a.category} · {a.recorded_by} · {hhmm(a.recorded_at)} · {a.credited} min credited</p>
              <p className="text-[12px] text-gray-900">{a.note}</p>
              {a.photo_url && <img src={a.photo_url} alt="" className="mt-1 h-14 w-14 rounded-lg border border-gray-200 object-cover" />}
            </div>
          ))}
        </div>
      )}
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
  return { busy, err, run }
}

function TileSheet({ t, ev, isToday, canEdit, present, onClose, onSaved }: { t: CheckTile; ev?: CheckEvent; isToday: boolean; canEdit: boolean; present: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [doneAt, setDoneAt] = useState(ev?.extra?.done_at ?? '')
  const [note, setNote] = useState(ev?.note ?? '')
  const [editing, setEditing] = useState(false)
  const { busy, err, run } = useRun(onSaved, onClose)
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
        {t.frequency === 'daily' && t.kind !== 'properties' && t.time && <p className="text-[11px] font-semibold text-red-700">If this is still undone at the end of the day, everyone clocked in gets a penalty point (at most 3 a day).</p>}
        {t.law_id && t.category && <a href={`/laws?cat=${encodeURIComponent(t.category)}`} className="block text-[11px] font-semibold text-blue-700 underline">From the Company Laws · {t.category}{t.subcategory ? ` › ${t.subcategory}` : ''}</a>}
        {t.minutes != null && <p className="text-[11px] font-semibold text-indigo-700">Counts as {t.minutes} minute{t.minutes === 1 ? '' : 's'} of work time for whoever does it.</p>}
        {ev?.note && !editableEv && <p className="text-xs text-gray-600">Note: {ev.note}</p>}
        {t.kind !== 'tap' && !ev && isToday && <AnswerForm t={t} present={present} onSaved={onSaved} onClose={onClose} />}
        {ev && t.kind !== 'tap' && <AnswerSummary ev={ev} />}
        {t.kind === 'tap' && isToday && (!ev || editableEv) && (<>
          <p className="text-xs font-bold uppercase text-gray-500">Time it was done {ev ? '' : '(blank = now)'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {[5, 10, 15, 30, 60].map(m => <button key={m} type="button" onClick={() => ago(m)} className="rounded-full bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-800">{m} min ago</button>)}
            <input type="time" value={doneAt} onChange={e => setDoneAt(e.target.value)} className="rounded-xl border border-gray-300 p-2 text-sm" />
            {doneAt && <button type="button" onClick={() => setDoneAt('')} className="text-xs font-semibold text-gray-500">Clear</button>}
          </div>
          <WithMic onText={t => setNote(x => (x ? x + ' ' : '') + t)}><input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" /></WithMic>
        </>)}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {t.kind === 'tap' && isToday && !ev && (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void record('Done')} className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Done now</button>
            <button type="button" disabled={busy} onClick={() => void record('Not done')} className="flex-1 rounded-xl bg-gray-600 py-3 text-base font-bold text-white disabled:opacity-40">Not done</button>
          </div>
        )}
        {t.kind !== 'tap' && editableEv && <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (back to waiting)</button>}
        {t.kind === 'tap' && editableEv && (<>
          <button type="button" disabled={busy} onClick={() => void patch({}, 'Saved')} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save changes</button>
          <button type="button" disabled={busy} onClick={() => void patch({ value: ev!.value === 'Not done' ? 'Done' : 'Not done' }, 'Changed')} className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white disabled:opacity-40">Change to {ev!.value === 'Not done' ? 'Done' : 'Not done'}</button>
          <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (back to waiting)</button>
        </>)}
        {canEdit && <a href={`/standards/manage?tile=${t.id}`} className="block py-1 text-sm font-semibold text-blue-700">Edit this tile in Tile Manager</a>}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

// A tile that opens a list (e.g. Mark printers): same Available / Not available, Working / Not working and Location choices as Properties in Expenses.
function PropsSheet({ t, ev, isToday, canEdit, onClose, onSaved }: { t: CheckTile; ev?: CheckEvent; isToday: boolean; canEdit: boolean; onClose: () => void; onSaved: (m: string) => void }) {
  const [props, setProps] = useState<Prop[] | null>(null)
  const [editing, setEditing] = useState(false)
  const { busy, err, run } = useRun(onSaved, onClose)
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
        {canEdit && <a href={`/standards/manage?tile=${t.id}`} className="block py-1 text-sm font-semibold text-blue-700">Edit this tile in Tile Manager</a>}
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
  const { busy, err, run } = useRun(onSaved, onClose)
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
  const { busy, err, run } = useRun(onSaved, onClose)
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

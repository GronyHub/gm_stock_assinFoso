'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  CHECK_SECTIONS, CHECKLIST_START, FREQUENCIES, NOT_AVAILABLE_REASONS, NOT_WORKING_REASONS, PERIOD_WORD, PROPERTY_LOCATIONS, WEEKDAY_LABEL,
  addDays, dayLabel, inPeriod, type CheckEvent, type CheckTile, type Frequency,
} from '@/lib/dailyChecksShared'

const json = { 'Content-Type': 'application/json' }
const hhmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}` }
const evTime = (e: CheckEvent) => e.extra?.done_at ?? hhmm(e.recorded_at)
const nowHM = () => { const d = new Date(); return d.getUTCHours() * 60 + d.getUTCMinutes() }
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

// Tiles that are a job done on another page of the app get a button that opens it (the stock count).
const linkFor = (t: CheckTile): { href: string; label: string } | null => /^count now/i.test(t.title) ? { href: '/item?view=counts', label: 'Open Counts' } : null

type Prop = { id: number; name: string; availability: string | null; working: string | null; location: string | null; not_working_reason: string | null; not_available_reason: string | null }

export default function DailyChecklistClient({ canEdit }: { canEdit: boolean }) {
  const [tiles, setTiles] = useState<CheckTile[]>([])
  const [events, setEvents] = useState<CheckEvent[]>([])
  const [day, setDay] = useState<string | null>(null)
  const [today, setToday] = useState('')
  const [section, setSection] = useState<string>('All day')
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [sheet, setSheet] = useState<CheckTile | null>(null)
  const [adding, setAdding] = useState(false)
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
        if (r.ok && Array.isArray(j.tiles)) { setTiles(j.tiles); setEvents(j.events); setToday(j.today); setDay(j.day); setError(''); return }
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
  const visible = useMemo(() => tiles, [tiles])
  const inSection = (s: string) => s === 'All day' ? visible.filter(t => t.frequency === 'daily' && t.time) : visible.filter(t => t.section === s)
  const doneCount = (s: string) => inSection(s).filter(t => latest(t)?.value === 'Done').length

  async function tap(t: CheckTile) {
    if (t.kind === 'properties') { setSheet(t); return }
    try {
      const r = await fetch('/api/daily-checks/tap', { method: 'POST', headers: json, body: JSON.stringify({ tile_id: t.id }) })
      if (!r.ok) throw new Error()
      flash(`Done: ${t.title}`); void load(day)
    } catch { flash('NOT saved. Try again.') }
  }

  const shown = section === 'All day' ? [...inSection('All day')].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '') || a.id - b.id) : inSection(section)
  const sections = ['All day', ...CHECK_SECTIONS.filter(s => inSection(s).length || canEdit)]
  // What to do right now: today's timed daily tiles that are not done. Late = 15 minutes or more past their time.
  const pending = isToday ? visible.filter(t => t.kind === 'tap' && t.frequency === 'daily' && t.time && !latest(t)).sort((a, b) => a.time!.localeCompare(b.time!) || a.id - b.id) : []
  const late = pending.filter(t => clock - toMin(t.time!) >= 15)
  const dueNow = pending.filter(t => { const d = clock - toMin(t.time!); return d >= 0 && d < 15 })
  const next = pending.filter(t => toMin(t.time!) > clock).slice(0, 3)
  const [showLate, setShowLate] = useState(false)
  const total = tiles.length, done = tiles.filter(t => latest(t)?.value === 'Done').length

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-1 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Daily Checklist</h1>
        <a href="/standards/reference" className="text-xs font-semibold text-blue-700 underline">Printable list</a>
        {canEdit && <button type="button" onClick={() => setAdding(true)} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">+ Add tile</button>}
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
          {late.length === 0 && dueNow.length === 0 && <p className="text-xs font-semibold text-green-700">Nothing late. {next.length ? 'Next up below.' : 'All timed tasks are done.'}</p>}
          {[{ label: 'LATE', rows: showLate ? late : late.slice(0, 4), cls: 'bg-red-50 border-red-300', more: late.length - 4 }, { label: 'DO NOW', rows: dueNow, cls: 'bg-amber-50 border-amber-300', more: 0 }, { label: 'NEXT', rows: next, cls: 'bg-gray-50 border-gray-200', more: 0 }].map(g => g.rows.length > 0 && (
            <div key={g.label} className="space-y-1">
              <p className={`text-[10px] font-extrabold ${g.label === 'LATE' ? 'text-red-600' : g.label === 'DO NOW' ? 'text-amber-700' : 'text-gray-500'}`}>{g.label}</p>
              {g.rows.map(t => (
                <div key={t.id} className={`flex items-center gap-2 rounded-lg border px-2 py-1 ${g.cls}`}>
                  <button type="button" onClick={() => setSheet(t)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <span className="text-lg leading-none">{t.icon}</span>
                    <span className="shrink-0 text-[10px] font-bold text-gray-500">{t.time}</span>
                    <span className="line-clamp-2 text-[11px] font-semibold leading-tight text-gray-900">{t.title}</span>
                  </button>
                  {g.label !== 'NEXT' && linkFor(t) && <a href={linkFor(t)!.href} className="shrink-0 rounded-lg bg-blue-600 px-2 py-1.5 text-xs font-bold text-white">{linkFor(t)!.label}</a>}
                  {g.label !== 'NEXT' && <button type="button" onClick={() => void tap(t)} className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white">Done</button>}
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
      <p className="mb-2 text-[11px] text-gray-500">{isToday ? 'Tiles are small so the whole day fits. Tap one to read it and mark it done. Red = late, amber = due now. Use the Done buttons in the NOW box to tick quickly. Each task you finish adds its minutes to your work time.' : 'This is a past day. You can look but not change it.'}</p>
      {shown.length === 0 && <p className="text-sm text-gray-400">Nothing here yet.{canEdit ? ' Use + Add tile.' : ''}</p>}
      <div className="grid grid-cols-10 gap-1 sm:grid-cols-12">
        {shown.map(t => {
          const ev = latest(t)
          const state = ev ? (ev.value === 'Not done' ? 'notdone' : 'done') : 'todo'
          const minsLate = !ev && isToday && t.frequency === 'daily' && t.time ? clock - toMin(t.time) : -1
          const isLate = minsLate >= 15
          const isDue = minsLate >= 0 && minsLate < 15
          return (
            <button key={t.id} type="button" title={`${t.time ? t.time + ' · ' : ''}${t.title}`} onContextMenu={e => e.preventDefault()}
              onClick={() => setSheet(t)}
              className={`relative flex aspect-square select-none flex-col items-center justify-center rounded-md border px-0 text-center active:opacity-70 ${state === 'done' ? 'border-green-500 bg-green-100' : state === 'notdone' ? 'border-gray-400 bg-gray-200' : isLate ? 'border-red-500 bg-red-100' : isDue ? 'border-amber-500 bg-amber-100' : 'border-gray-200 bg-white'}`}>
              <span className="text-base leading-none sm:text-xl">{t.icon}</span>
              <span className={`mt-px text-[7px] font-bold leading-none sm:text-[9px] ${isLate ? 'text-red-700' : 'text-gray-500'}`}>{t.frequency !== 'daily' ? (t.weekday ? WEEKDAY_LABEL[t.weekday].slice(0, 3) : t.frequency.slice(0, 4)) : (t.time ?? '')}</span>
              {state === 'done' && <span className="absolute right-0 top-0 text-[8px] font-bold leading-none text-green-700">✓</span>}
              {state === 'notdone' && <span className="absolute right-0 top-0 text-[8px] font-bold leading-none text-gray-600">✕</span>}
            </button>
          )
        })}
      </div>
      {sheet && (sheet.kind === 'properties'
        ? <PropsSheet t={sheet} ev={latest(sheet)} isToday={isToday} canEdit={canEdit} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load(day) }} />
        : <TileSheet t={sheet} ev={latest(sheet)} isToday={isToday} canEdit={canEdit} onClose={() => setSheet(null)} onSaved={m => { flash(m); void load(day) }} />)}
      {reporting && <DayReport day={day ?? today} onClose={() => setReporting(false)} />}
      {adding && <TileForm section={section} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); void load(day) }} />}
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

function TileSheet({ t, ev, isToday, canEdit, onClose, onSaved }: { t: CheckTile; ev?: CheckEvent; isToday: boolean; canEdit: boolean; onClose: () => void; onSaved: (m: string) => void }) {
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
        {t.minutes != null && <p className="text-[11px] font-semibold text-indigo-700">Counts as {t.minutes} minute{t.minutes === 1 ? '' : 's'} of work time for whoever does it.</p>}
        {ev?.note && !editableEv && <p className="text-xs text-gray-600">Note: {ev.note}</p>}
        {isToday && (!ev || editableEv) && (<>
          <p className="text-xs font-bold uppercase text-gray-500">Time it was done {ev ? '' : '(blank = now)'}</p>
          <div className="flex flex-wrap items-center gap-2">
            {[5, 10, 15, 30, 60].map(m => <button key={m} type="button" onClick={() => ago(m)} className="rounded-full bg-indigo-100 px-3 py-2 text-sm font-semibold text-indigo-800">{m} min ago</button>)}
            <input type="time" value={doneAt} onChange={e => setDoneAt(e.target.value)} className="rounded-xl border border-gray-300 p-2 text-sm" />
            {doneAt && <button type="button" onClick={() => setDoneAt('')} className="text-xs font-semibold text-gray-500">Clear</button>}
          </div>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        </>)}
        {err && <p className="text-sm text-red-600">{err}</p>}
        {isToday && !ev && (
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void record('Done')} className="flex-1 rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Done now</button>
            <button type="button" disabled={busy} onClick={() => void record('Not done')} className="flex-1 rounded-xl bg-gray-600 py-3 text-base font-bold text-white disabled:opacity-40">Not done</button>
          </div>
        )}
        {editableEv && (<>
          <button type="button" disabled={busy} onClick={() => void patch({}, 'Saved')} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Save changes</button>
          <button type="button" disabled={busy} onClick={() => void patch({ value: ev!.value === 'Not done' ? 'Done' : 'Not done' }, 'Changed')} className="w-full rounded-xl bg-amber-500 py-3 text-base font-bold text-white disabled:opacity-40">Change to {ev!.value === 'Not done' ? 'Done' : 'Not done'}</button>
          <button type="button" disabled={busy} onClick={revert} className="w-full rounded-xl bg-red-50 py-3 text-base font-bold text-red-700 disabled:opacity-40">Remove record (back to waiting)</button>
        </>)}
        {canEdit && <TileEditor t={t} editing={editing} setEditing={setEditing} onSaved={onSaved} onClose={onClose} />}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

function TileEditor({ t, editing, setEditing, onSaved, onClose }: { t: CheckTile; editing: boolean; setEditing: (v: boolean) => void; onSaved: (m: string) => void; onClose: () => void }) {
  const [title, setTitle] = useState(t.title)
  const [time, setTime] = useState(t.time ?? '')
  const [icon, setIcon] = useState(t.icon)
  const [sec, setSec] = useState(t.section)
  const [freq, setFreq] = useState<Frequency>(t.frequency)
  const [how, setHow] = useState(t.how ?? '')
  const [mins, setMins] = useState(String(t.minutes ?? 5))
  const [filter, setFilter] = useState(t.prop_filter ?? '')
  const { busy, err, run } = useRun(onSaved, onClose)
  return (
    <div className="space-y-2 border-t border-gray-100 pt-3">
      <button type="button" onClick={() => setEditing(!editing)} className="text-sm font-semibold text-blue-700">{editing ? 'Hide' : 'Edit this tile'}</button>
      {editing && (<>
        <div className="flex gap-2">
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={8} className="w-16 rounded-xl border border-gray-300 p-3 text-center text-2xl" aria-label="Picture" />
          <input value={title} onChange={e => setTitle(e.target.value)} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm" />
        </div>
        <div className="flex gap-2">
          <select value={sec} onChange={e => setSec(e.target.value)} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm">{CHECK_SECTIONS.map(s => <option key={s}>{s}</option>)}</select>
          <select value={freq} onChange={e => setFreq(e.target.value as Frequency)} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm">{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="rounded-xl border border-gray-300 p-3 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">Work time credited when ticked
          <input type="number" min={0} max={240} value={mins} onChange={e => setMins(e.target.value)} className="w-20 rounded-xl border border-gray-300 p-2 text-sm" /> minutes</label>
        <textarea value={how} onChange={e => setHow(e.target.value)} placeholder="How (shown to staff)" rows={2} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        {t.kind === 'properties' && <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Words in the property name, separated by commas" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />}
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || !title.trim()} onClick={() => void run(() => fetch(`/api/daily-checks/${t.id}`, { method: 'PUT', headers: json, body: JSON.stringify({ title, section: sec, time, icon, frequency: freq, how, minutes: Number(mins), prop_filter: filter }) }), 'Tile updated')} className="w-full rounded-xl bg-blue-600 py-3 text-base font-bold text-white disabled:opacity-40">Save tile</button>
        <button type="button" disabled={busy} onClick={() => { if (confirm('Remove this tile from the checklist? Past records are kept.')) void run(() => fetch(`/api/daily-checks/${t.id}`, { method: 'DELETE' }), 'Tile removed') }} className="w-full py-2 text-sm font-semibold text-red-600">Remove this tile</button>
      </>)}
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
        {canEdit && <TileEditor t={t} editing={editing} setEditing={setEditing} onSaved={onSaved} onClose={onClose} />}
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Close</button>
      </div>
    </div>
  )
}

function TileForm({ section, onClose, onSaved }: { section: string; onClose: () => void; onSaved: () => void }) {
  const [sec, setSec] = useState(section)
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [icon, setIcon] = useState('✅')
  const [freq, setFreq] = useState<Frequency>('daily')
  const [list, setList] = useState(false)
  const [filter, setFilter] = useState('')
  const [how, setHow] = useState('')
  const [mins, setMins] = useState('5')
  const [err, setErr] = useState('')
  async function save() {
    const r = await fetch('/api/daily-checks', { method: 'POST', headers: json, body: JSON.stringify({ section: sec, title, time, icon, frequency: freq, how, minutes: Number(mins), kind: list ? 'properties' : 'tap', prop_filter: filter }) })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) setErr(d.error ?? 'Could not save'); else onSaved()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[90vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">Add a tile</p>
        <div className="flex gap-2">
          <input value={icon} onChange={e => setIcon(e.target.value)} maxLength={8} className="w-16 rounded-xl border border-gray-300 p-3 text-center text-2xl" aria-label="Picture" />
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What must be done" className="flex-1 rounded-xl border border-gray-300 p-3 text-sm" />
        </div>
        <div className="flex gap-2">
          <select value={sec} onChange={e => setSec(e.target.value)} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm">{CHECK_SECTIONS.map(s => <option key={s}>{s}</option>)}</select>
          <select value={freq} onChange={e => setFreq(e.target.value as Frequency)} className="flex-1 rounded-xl border border-gray-300 p-3 text-sm">{FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select>
          <input type="time" value={time} onChange={e => setTime(e.target.value)} className="rounded-xl border border-gray-300 p-3 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">Work time credited when ticked
          <input type="number" min={0} max={240} value={mins} onChange={e => setMins(e.target.value)} className="w-20 rounded-xl border border-gray-300 p-2 text-sm" /> minutes</label>
        <textarea value={how} onChange={e => setHow(e.target.value)} placeholder="How (optional, shown to staff)" rows={2} className="w-full rounded-xl border border-gray-300 p-3 text-sm" />
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={list} onChange={e => setList(e.target.checked)} /> This tile opens a list (items from Properties)</label>
        {list && <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Words in the property name, e.g. printer" className="w-full rounded-xl border border-gray-300 p-3 text-sm" />}
        <p className="text-[11px] text-gray-500">The time is only a guide. For a weekly or monthly task, staff tick it once for that week or month.</p>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={!title.trim()} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">Add tile</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}

type Report = { day: string; total: number; done: number; people: { person: string; done: number; minutes: number }[]; missed: { id: number; section: string; time: string | null; icon: string; title: string }[] }
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

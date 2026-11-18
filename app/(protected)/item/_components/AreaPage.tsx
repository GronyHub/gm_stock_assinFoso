'use client'
import { useEffect, useState } from 'react'
import TaskTile from '@/components/TaskTile'
import { TileSheet } from '@/app/(protected)/standards/DailyChecklistClient'
import { inPeriod, type CheckTile, type CheckEvent } from '@/lib/dailyChecksShared'
import type { Duty } from '@/lib/duties'
import { fmtDate } from '@/lib/fmtDate'

type Point = { id: number; staff: string; points: number; reason: string; day: string; status: string; law_code: string | null; law_title: string | null }
type Done = { tile_id: number; title: string; day: string; recorded_by: string; value: string; note: string | null; photo: string | null; recorded_at: string | null }
type Missed = { day: string; title: string; owner: string | null; reason: string | null; state: string }
type Record_ = { days: number; all: boolean; people: Record<string, { points: number; done: number; missed: number }>; points: Point[]; done: Done[]; missed: Missed[]; missedDays: number }

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// One area of the shop on one page, with three sections: the laws that govern it (Rules), how they were kept (How it went:
// duties recorded and penalty points) and a place for staff to write something about it (Record). The same area key
// as the Laws page tile, so the Laws page and this page always show the same laws.
export default function AreaPage({ areaKey, label, icon, categories, subs }: { areaKey: string; label: string; icon: string; categories: string[]; subs?: string[] }) {
  const [tab, setTab] = useState<'rules' | 'went' | 'record'>('record')
  const sq = subs?.length ? `&subs=${encodeURIComponent(subs.join('|'))}` : ''
  const [days, setDays] = useState(30)
  const [sub, setSub] = useState<'notdone' | 'done'>('notdone')
  const [data, setData] = useState<Record_ | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (tab !== 'went') return
    setData(null); setFailed(false)
    fetch(`/api/area-record?area=${areaKey}&days=${days}${sq}`, { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setFailed(true))
  }, [tab, days, areaKey, sq])

  const people = data ? Object.entries(data.people).sort((a, b) => b[1].points - a[1].points || b[1].done - a[1].done) : []

  return (
    <div>
      <div role="tablist" className="mb-2 flex gap-1.5 sm:max-w-xl">
        {([['rules', '📜 Rules'], ['went', '📊 How it went'], ['record', '✍️ Record']] as const).map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${tab === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{t}</button>
        ))}
      </div>

      {tab === 'rules' && <iframe src={`/laws?tile=${areaKey}&embed=1${sq}`} title={`${label} laws`} className="h-[72vh] w-full rounded-lg border border-gray-200 sm:h-[78vh]" />}

      {tab === 'record' && <AreaRecord label={label} icon={icon} areaCategories={categories} subs={subs} />}

      {tab === 'went' && (
        <div className="max-w-4xl space-y-3">
          <div className="flex items-center gap-1.5">
            {[7, 30, 90].map(d => <button key={d} type="button" onClick={() => setDays(d)} className={`rounded-full px-3 py-1 text-[13px] font-semibold ${days === d ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600'}`}>{d} days</button>)}
          </div>
          {failed && <p className="py-6 text-center text-sm text-red-600">Could not load. Try again.</p>}
          {!data && !failed && <p className="py-6 text-center text-sm text-gray-400">Loading…</p>}
          {data && (<>
            <p className="text-[12px] text-gray-500">{data.all ? 'Everyone, last' : 'Only you, last'} {data.days} days.</p>
            {people.length === 0 && data.missed.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">Nothing recorded for {label} in this time.</p> : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-[12px] font-semibold uppercase text-gray-500"><span>Staff</span><span className="text-right">Done</span><span className="text-right">Not done</span><span className="text-right">Points</span></div>
                {people.map(([n, v]) => (
                  <div key={n} className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 border-b border-gray-100 px-3 py-2 text-[14px] last:border-0">
                    <span className="text-gray-900">{cap(n)}</span>
                    <span className="text-right tabular-nums text-green-700">{v.done}</span>
                    <span className={`text-right tabular-nums ${v.missed ? 'font-semibold text-amber-700' : 'text-gray-400'}`}>{v.missed}</span>
                    <span className={`text-right tabular-nums ${v.points ? 'font-semibold text-red-700' : 'text-gray-400'}`}>{v.points}</span>
                  </div>
                ))}
              </div>
            )}
            <div role="tablist" className="flex gap-1.5">
              {([['notdone', `Not done (${data.missed.length})`], ['done', `Done (${data.done.length})`]] as const).map(([k, t]) => (
                <button key={k} type="button" role="tab" aria-selected={sub === k} onClick={() => setSub(k)}
                  className={`flex-1 rounded-lg px-2 py-2 text-[13px] font-semibold ${sub === k ? (k === 'done' ? 'bg-green-600 text-white' : 'bg-amber-500 text-white') : 'bg-gray-100 text-gray-600'}`}>{t}</button>
              ))}
            </div>
            {sub === 'notdone' && data.missed.length === 0 && data.points.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Nothing was left undone in this time.</p>}
            {sub === 'done' && data.done.length === 0 && <p className="py-4 text-center text-sm text-gray-500">Nothing was recorded as done in this time.</p>}
            {sub === 'notdone' && data.missed.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-gray-800">Not done{data.missedDays < data.days ? ` (last ${data.missedDays} days)` : ''}</p>
                <ul className="space-y-1.5">
                  {data.missed.map((m, i) => (
                    <li key={i} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-gray-900">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{m.owner ? cap(m.owner) : 'Nobody'} · {fmtDate(m.day)}</span><span className="text-[12px] font-semibold text-amber-800">{m.state === 'no' ? 'Reason given' : m.state === 'late' ? 'Late today' : 'Missed'}</span></div>
                      <p className="text-gray-700">{m.title}</p>
                      {m.reason && <p className="text-[12px] text-gray-600">Reason: {m.reason}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sub === 'notdone' && data.points.length > 0 && (
              <div>
                <p className="mb-1 text-[13px] font-semibold text-gray-800">Penalty points</p>
                <ul className="space-y-1.5">
                  {data.points.map(p => (
                    <li key={p.id} className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-gray-900">
                      <div className="flex items-center justify-between gap-2"><span className="font-semibold">{cap(p.staff)} · {fmtDate(p.day)}</span><span className="font-bold text-red-700">{p.points} pt{p.points === 1 ? '' : 's'}</span></div>
                      <p className="text-gray-700">{p.law_code ? `${p.law_code}: ` : ''}{p.law_title ?? p.reason}</p>
                      {p.status === 'pending' && <p className="text-[12px] text-amber-700">Waiting for a decision</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sub === 'done' && data.done.length > 0 && (
              <div>
                <ul className="space-y-1">
                  {data.done.slice(0, 60).map((d, i) => (
                    <li key={i} className="rounded-lg bg-white ring-1 ring-gray-200">
                      <details>
                        <summary className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[13px] text-gray-800 [&::-webkit-details-marker]:hidden">
                          <span className="min-w-0 truncate">{d.photo ? '📷 ' : d.note ? '📝 ' : ''}{d.title}</span><span className="shrink-0 text-gray-500">{cap(d.recorded_by)} · {fmtDate(d.day)}</span>
                        </summary>
                        <div className="space-y-1.5 border-t border-gray-100 px-3 py-2 text-[13px] text-gray-800">
                          <p className="text-[12px] text-gray-500">Done by {cap(d.recorded_by)} on {fmtDate(d.day)}{d.recorded_at ? ` at ${new Date(d.recorded_at).toISOString().slice(11, 16)}` : ''}.</p>
                          {d.note ? <p>{d.note}</p> : !d.photo ? <p className="text-gray-500">No note or photo with this one.</p> : null}
                          {d.photo && <a href={d.photo} target="_blank" rel="noreferrer"><img src={d.photo} alt={`Photo: ${d.title}`} loading="lazy" className="max-h-60 w-auto rounded-lg border border-gray-200" /></a>}
                        </div>
                      </details>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>)}
        </div>
      )}
    </div>
  )
}

// Record: today's tasks of this area. Tapping one opens the same pop-up as Today (tick, photo, question), so staff record by doing the task; nothing is typed into a separate log here.
// What was recorded is listed under How it went > Done.
function AreaRecord({ label, icon, areaCategories, subs }: { label: string; icon: string; areaCategories: string[]; subs?: string[] }) {
  const [data, setData] = useState<{ tiles: CheckTile[]; duties: Duty[]; events: CheckEvent[]; day: string; present: string[]; clockedIn: boolean } | null>(null)
  const [failed, setFailed] = useState(false)
  const [sheet, setSheet] = useState<CheckTile | null>(null)
  const [toast, setToast] = useState('')
  const load = () => { fetch('/api/daily-checks', { cache: 'no-store' }).then(r => (r.ok ? r.json() : Promise.reject())).then(j => setData({ tiles: j.tiles ?? [], duties: j.duties ?? [], events: j.events ?? [], day: j.day ?? j.today, present: j.present ?? [], clockedIn: j.clockedIn !== false })).catch(() => setFailed(true)) }
  useEffect(load, [])
  if (failed) return <p className="py-6 text-center text-sm text-red-600">Could not load. Try again.</p>
  if (!data) return <p className="py-6 text-center text-sm text-gray-400">Loading…</p>
  const mine = new Map(data.tiles.filter(t => t.category && areaCategories.includes(t.category) && (!subs?.length || subs.includes(t.subcategory ?? ''))).map(t => [t.id, t]))
  const duties = data.duties.filter(d => d.kind === 'task' && mine.has(d.id)).sort((a, b) => a.due - b.due)
  const latest = (t: CheckTile) => data.events.filter(e => e.tile_id === t.id && inPeriod(t.frequency, e.day, data.day)).at(-1)
  const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  return (
    <div className="space-y-2">
      <p className="text-[12px] text-gray-500">{icon} Today's {label} tasks. Tap one to record it, the same as on Today. Everything recorded is listed under How it went.</p>
      {toast && <p className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white">{toast}</p>}
      {!data.clockedIn && <p className="rounded-lg bg-amber-50 px-3 py-2 text-[13px] text-amber-900">Clock in first. Tasks can be recorded only while you are clocked in at the shop.</p>}
      {duties.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No {label} tasks today.</p> : (
        <div className="grid max-w-4xl grid-cols-2 gap-1.5 sm:grid-cols-3">
          {duties.map(d => (
            <TaskTile key={d.key} density="full" time={`${hm(d.due)}${d.mins ? ` · ${d.mins} min` : ''}`} title={d.title} who={d.by ? d.by.charAt(0).toUpperCase() + d.by.slice(1) : d.role ?? (d.owner ? d.owner.charAt(0).toUpperCase() + d.owner.slice(1) : 'Anyone on shift')}
              mark={d.state === 'done' ? 'done' : d.state === 'no' ? 'no' : d.state === 'miss' || d.state === 'late' ? 'miss' : undefined}
              tone={d.state === 'done' ? 'border-green-400 bg-green-50' : d.state === 'no' ? 'border-gray-300 bg-gray-100' : d.state === 'miss' || d.state === 'late' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'}
              onClick={() => setSheet(mine.get(d.id)!)} />
          ))}
        </div>
      )}
      {sheet && <TileSheet t={sheet} ev={latest(sheet)} isToday canEdit={false} present={data.present} onClose={() => setSheet(null)} onSaved={m => { setToast(m); setTimeout(() => setToast(''), 3000); load() }} />}
    </div>
  )
}
